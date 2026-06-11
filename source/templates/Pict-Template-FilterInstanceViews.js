const libPictTemplate = require('pict-template');
const libFilterViews = require('../views/filters/index.js');

/**
 * Specialized instruction for rendering the filter view and plumbing in required context.
 *
 * Based on the Pict base {~V:...~} template instruction.
 *
 * ## Async render architecture (see renderAsync below)
 *
 * The async path is tuned to get the dashboard records list painted before any
 * speculative filter-list REST lookups complete. Three things collaborate to
 * make that happen:
 *
 * 1. **Parallel filter fan-out.** Every filter clause starts its own
 *    `renderWithScopeAsync` in a single pass, instead of chaining through a
 *    sequential `Anticipate` queue. Template parsing, `onBefore*`/`onProject*`
 *    microtask hops, and the synchronous DOM walks done inside each filter's
 *    `onAfterRender` all happen concurrently rather than serialized across N
 *    filters. Results are collected into an indexed array so final output
 *    order still matches the clause order.
 *
 * 2. **Per-filter transaction isolation.** Each filter render gets its own
 *    synthetic `RootRenderable` carrying a fresh `TransactionHash`. Any
 *    `virtual-assignment` sub-renders that the filter's dynamic form spawns
 *    (notably `PSRSFilterProxyView`, which pict-section-form uses to host
 *    each filter's input) push into THIS transaction's queue, not the
 *    dashboard's. The dashboard's outer `renderAsync` callback fires as soon
 *    as every filter has its template string - without waiting on any of
 *    the nested input-initialize work.
 *
 * 3. **Deferred post-render drain.** The filter's post-render pipeline
 *    (`onAfterRenderAsync`, which is what runs pict-section-form's
 *    `runInputProviderFunctions('onInputInitialize', ...)` and therefore
 *    triggers `EntityBundleRequest.gatherDataFromServer` for any
 *    speculative-load inputs) is intentionally NOT run inline. It is queued
 *    via `setTimeout(..., 0)` so it fires on the next macrotask, giving the
 *    browser a tick to paint the dashboard first.
 *
 * ### Render-epoch race guard
 *
 * Between the dashboard callback firing and the setTimeout actually running,
 * the user may have navigated away / applied a different filter experience /
 * cleared filters. The `PRSP-Filters` view owns a monotonic `_renderEpoch`
 * counter that gets bumped on every mutating action (`performSearch`,
 * `handleClear`, `handleReset`, `addFilter`, `removeFilter`). Each scheduled
 * drain captures the epoch at schedule time and bails out if a newer render
 * has invalidated it, so a stale REST response can never clobber a filter
 * container that now belongs to a different experience.
 */
class PictTemplateFilterInstanceViewInstruction extends libPictTemplate
{
	/**
	 * @param {Object} pFable - The Fable Framework instance
	 * @param {Object} pOptions - The options for the service
	 * @param {String} pServiceHash - The hash of the service
	 */
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		/** @type {any} */
		this.log;

		this.addPattern('{~FIV:', '~}');
		this.addPattern('{~FilterInstanceViews:', '~}');


		if (!('__TemplateOutputCache' in this.pict))
		{
			this.pict.__TemplateOutputCache = {};
		}
	}

	_getViewForFilterClause(pClause)
	{
		// Quick-filter clauses are surfaced in the Quick Filters bar (RecordSet-Filters._renderQuickFilters),
		// not the drawer's clause list — skip them here so they aren't rendered twice. Both the sync and
		// async render loops treat a null view as "skip this clause".
		if (pClause && pClause.QuickFilter) { return null; }
		// The show-deleted switch is a RawFilter clause whose face is the drawer-footer checkbox
		// (RecordSet-Filters._renderShowDeletedControl) — without this skip it would fall through to
		// the Base filter card, which renders a debug dump for types with no real filter view.
		if (pClause && pClause.ShowDeletedKey) { return null; }
		let tmpViewHash = `PRSP-FilterType-${pClause.Type}`;
		const tmpCustomViewHash = `${tmpViewHash}-${pClause.CustomFilterViewHash}`;
		if (tmpCustomViewHash in this.pict.views)
		{
			tmpViewHash = tmpCustomViewHash;
		}
		/** @type {import('../views/filters/RecordSet-Filter-Base.js')} */
		let tmpView = this.pict.views[tmpViewHash];
		if (!tmpView)
		{
			const tmpViewPrototype = libFilterViews[pClause.Type] || libFilterViews.Base;
			if (!tmpViewPrototype)
			{
				this.pict.log.error(`Pict: Filter Instance Views Template Render: No view prototype found for filter type [${pClause.Type}]`);
				return null;
			}
			//FIXME: is this safe? will this view get rendered at other times?
			tmpView = this.pict.addView(tmpViewHash, { }, tmpViewPrototype);
		}
		return tmpView;
	}

	/**
	 * Render a template expression, returning a string with the resulting content.
	 *
	 * @param {string} pTemplateHash - The hash contents of the template (what's between the template start and stop tags)
	 * @param {any} pRecord - The json object to be used as the Record for the template render
	 * @param {Array<any>} pContextArray - An array of context objects accessible from the template; safe to leave empty
	 * @param {any} [pScope] - A sticky scope that can be used to carry state and simplify template
	 * @param {any} [pState] - A catchall state object for plumbing data through template processing.
	 *
	 * @return {string} The rendered template
	 */
	render(pTemplateHash, pRecord, pContextArray, pScope, pState)
	{
		const tmpRecordSet = pRecord.RecordSet || '';
		if (!tmpRecordSet)
		{
			this.pict.log.error(`Pict: Filter Instance Views Template Render: No record set specified in record`);
			return '';
		}
		const tmpRecordSetConfiguration = this.pict.PictSectionRecordSet.recordSetProviderConfigurations?.[tmpRecordSet];
		if (!tmpRecordSetConfiguration)
		{
			this.pict.log.error(`Pict: Filter Instance Views Template Render: No record set configuration found for [${tmpRecordSet}]`);
			return '';
		}
		let tmpViewContext = pRecord.ViewContext;
		if (tmpViewContext)
		{
			tmpViewContext = tmpViewContext.trim();
		}
		else
		{
			tmpViewContext = 'Default';
		}
		pRecord = pRecord || {};
		if (!pRecord.RecordSet)
		{
			pRecord.RecordSet = tmpRecordSet;
		}
		if (!pRecord.RecordSetConfiguration)
		{
			pRecord.RecordSetConfiguration = tmpRecordSetConfiguration;
		}
		if (!pRecord.ViewContext)
		{
			pRecord.ViewContext = pRecord.DashboardHash ? `${tmpViewContext}-${pRecord.DashboardHash}` : tmpViewContext;
		}

		let tmpRenderGUID = this.pict.getUUID();
		let tmpResult = '';

		const tmpClauses = this.pict.Bundle._ActiveFilterState?.[pRecord.RecordSet]?.FilterClauses || [];
		//FIXME: lookup by hash instead?
		for (let i = 0; i < tmpClauses.length; i++)
		{
			const tmpClause = tmpClauses[i];
			/** @type {import('../views/filters/RecordSet-Filter-Base.js')} */
			const tmpView = this._getViewForFilterClause(tmpClause);
			if (!tmpView)
			{
				continue;
			}

			const tmpRecord = Object.assign({}, pRecord, tmpClause);
			//tmpRecord.ClauseAddress = `Bundle._ActiveFilterState['${pRecord.RecordSet}'].FilterClauses[${i}]`;
			tmpRecord.ClauseAddress = `_ActiveFilterState[\`${pRecord.RecordSet}\`].FilterClauses[${i}]`;
			tmpView.prepareRecord(tmpRecord);
			tmpView.renderWithScope(tmpClause, '__Virtual', `__TemplateOutputCache.${tmpRenderGUID}`, tmpRecord, pState && pState.RootRenderable);

			tmpResult += this.pict.__TemplateOutputCache[tmpRenderGUID];
			// TODO: Uncomment this when we like how it's working
			//delete this.pict.__TemplateOutputCache[tmpRenderGUID];

		}
		return tmpResult;
	}

	/**
	 * @param {string} pTemplateHash - The hash contents of the template (what's between the template start and stop tags)
	 * @param {any} pRecord - The json object to be used as the Record for the template
	 * @param {(pError?: Error, pResult?: string) => void} fCallback - The callback function to call with the result
	 * @param {Array<any>} pContextArray - An array of context objects accessible from the template; safe to leave empty
	 * @param {any} [pScope] - A sticky scope that can be used to carry state and simplify template
	 * @param {any} [pState] - A catchall state object for plumbing data through template processing.
	 * @return {void}
	 */
	renderAsync(pTemplateHash, pRecord, fCallback, pContextArray, pScope, pState)
	{
		const tmpRecordSet = pRecord.RecordSet || '';
		if (!tmpRecordSet)
		{
			this.pict.log.error(`Pict: Filter Instance Views Template Render: No record set specified in record`);
			return fCallback(null, '');
		}
		const tmpRecordSetConfiguration = this.pict.PictSectionRecordSet.recordSetProviderConfigurations?.[tmpRecordSet];
		if (!tmpRecordSetConfiguration)
		{
			this.pict.log.error(`Pict: Filter Instance Views Template Render: No record set configuration found for [${tmpRecordSet}]`);
			return fCallback(null, '');
		}
		let tmpViewContext = pRecord.ViewContext;
		if (tmpViewContext)
		{
			tmpViewContext = tmpViewContext.trim();
		}
		else
		{
			tmpViewContext = 'Default';
		}

		pRecord = pRecord || {};
		if (!pRecord.RecordSet)
		{
			pRecord.RecordSet = tmpRecordSet;
		}
		if (!pRecord.RecordSetConfiguration)
		{
			pRecord.RecordSetConfiguration = tmpRecordSetConfiguration;
		}
		if (!pRecord.ViewContext)
		{
			pRecord.ViewContext = pRecord.DashboardHash ? `${tmpViewContext}-${pRecord.DashboardHash}` : tmpViewContext;
		}

		const tmpClauses = this.pict.Bundle._ActiveFilterState?.[pRecord.RecordSet]?.FilterClauses || [];
		if (tmpClauses.length === 0)
		{
			return fCallback(null, '');
		}

		// Snapshot the current render epoch so the deferred drain below can
		// detect a filter re-render that happened between schedule time and
		// now (see class doc-comment, "Render-epoch race guard").
		const tmpFiltersView = this.pict.views['PRSP-Filters'];
		const tmpRenderEpoch = tmpFiltersView ? tmpFiltersView._renderEpoch : 0;

		const tmpResults = new Array(tmpClauses.length).fill('');
		const tmpDeferredDrains = [];
		let tmpRemaining = tmpClauses.length;
		let tmpCallbackFired = false;

		const tmpFinalize = () =>
		{
			if (tmpCallbackFired || tmpRemaining > 0)
			{
				return;
			}
			tmpCallbackFired = true;
			// Fire the dashboard callback first so the paint lands on the
			// current tick, then defer the filters' onAfterRender work (which
			// runs pict-section-form's input-initialize pass and fires any
			// EntityBundleRequest REST calls) to the next macrotask.
			fCallback(null, tmpResults.join(''));
			if (tmpDeferredDrains.length === 0)
			{
				return;
			}
			setTimeout(() =>
			{
				// Epoch guard: bail out if a newer render has invalidated us.
				if (tmpFiltersView && tmpFiltersView._renderEpoch !== tmpRenderEpoch)
				{
					return;
				}
				for (let d = 0; d < tmpDeferredDrains.length; d++)
				{
					try
					{
						tmpDeferredDrains[d]();
					}
					catch (pError)
					{
						this.log.warn(`Pict: Filter Instance Views Template Render: Error draining deferred filter transaction`, pError);
					}
				}
			}, 0);
		};

		//FIXME: lookup by hash instead?
		for (let i = 0; i < tmpClauses.length; i++)
		{
			const tmpClause = tmpClauses[i];
			/** @type {import('../views/filters/RecordSet-Filter-Base.js')} */
			const tmpView = this._getViewForFilterClause(tmpClause);
			if (!tmpView)
			{
				tmpRemaining--;
				continue;
			}

			const tmpRenderGUID = this.pict.getUUID();
			const tmpRecord = Object.assign({}, pRecord, tmpClause);
			tmpRecord.ClauseAddress = `_ActiveFilterState[${pRecord.RecordSet}].FilterClauses[${i}]`;
			tmpView.prepareRecord(tmpRecord);

			// Synthetic per-filter root renderable: nested virtual-assignment
			// renders from this filter's subtree push into the filter's own
			// transaction queue instead of the dashboard's.
			const tmpFilterTransactionHash = `FilterInstance-${tmpView.Hash}-${tmpRenderGUID}`;
			this.pict.TransactionTracking.registerTransaction(tmpFilterTransactionHash);
			/** @type {import('pict-view').Renderable} */
			const tmpFilterRootRenderable =
			{
				RenderableHash: '__Virtual',
				TemplateHash: null,
				ContentDestinationAddress: null,
				RenderMethod: 'virtual-assignment',
				TransactionHash: tmpFilterTransactionHash,
				RootRenderableViewHash: tmpView.Hash,
			};

			tmpDeferredDrains.push(() =>
			{
				tmpView.onAfterRenderAsync(() =>
				{
					// Remove the per-filter transaction we registered above
					// once its drain completes. Pict-View will also attempt
					// to unregister during its own onAfterRenderAsync chain;
					// whichever call hits first wins, the other is a no-op.
					this.pict.TransactionTracking.unregisterTransaction(tmpFilterTransactionHash);
				}, tmpFilterRootRenderable);
			});

			tmpView.renderWithScopeAsync(tmpClause, '__Virtual', `__TemplateOutputCache.${tmpRenderGUID}`, tmpRecord, tmpFilterRootRenderable,
				(pError) =>
				{
					if (pError)
					{
						this.log.warn(`Pict: Filter Instance Views Template Render: Error rendering view [${tmpView.Hash}]`, pError);
						//TODO: should we fail the whole render?
						tmpResults[i] = '';
					}
					else
					{
						tmpResults[i] = this.pict.__TemplateOutputCache[tmpRenderGUID] || '';
						// TODO: Uncomment this when we like how it's working
						//delete this.pict.__TemplateOutputCache[tmpRenderGUID];
					}
					tmpRemaining--;
					tmpFinalize();
				});
		}
		// Handle the case where every filter was skipped synchronously (no valid view).
		tmpFinalize();
	}
}

module.exports = PictTemplateFilterInstanceViewInstruction;
