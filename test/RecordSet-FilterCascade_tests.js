/*
	Unit tests for CascadeFrom — one quick filter narrowing another.

	The customer case: a Stockpile dashboard where picking a Site should collapse
	the Product list to the products that Site actually has, rather than listing
	every product in the system.

	Covered:
	  - no CascadeFrom -> the static DistinctFilter is used unchanged (so the
	    feature cannot change behaviour for the dashboards already shipped)
	  - a parent with NOTHING selected narrows nothing (the right zero state)
	  - a parent with a selection appends FBL~<col>~INN~<values>
	  - several parents compose
	  - the resolved filter is part of the cache key, so two different parent
	    selections cache separately
	  - values containing a comma are skipped rather than splitting the IN list
	  - the drawer view and the quick bar agree on the same rule

	All offline — no REST client is touched.
*/

const libBrowserEnv = require('browser-env');
libBrowserEnv({ url: 'http://localhost/' });

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');

const libRecordProviderMeadow = require('../source/providers/RecordSet-RecordProvider-MeadowEndpoints.js');
const libFilterDistinctView = require('../source/views/filters/RecordSet-Filter-DistinctSelectedValueList.js');
const libFiltersView = require('../source/views/RecordSet-Filters.js');

suite
(
	'PictSectionRecordSet Filter Cascade Tests',
	() =>
	{
		suite
		(
			'Drawer clause filter resolution',
			() =>
			{
				/** @type {libPict} */
				let _Pict;
				let _View;
				let _Provider;

				setup(() =>
				{
					_Pict = new libPict();
					_Pict.addView('PRSP-FilterType-Base', {}, require('../source/views/filters/RecordSet-Filter-Base.js'));
					_View = _Pict.addView('PRSP-FilterType-DistinctSelectedValueList', {}, libFilterDistinctView);
					_Pict.addProvider('RSP-Provider-Stockpile', { RecordSet: 'Stockpile', Entity: 'C182_PD_StockpileVerificationSample' }, libRecordProviderMeadow);
					_Provider = _Pict.providers['RSP-Provider-Stockpile'];
					// Stand in for the live clause state the provider reads selections out of.
					_Provider._selected = {};
					_Provider.getQuickFilterEntityValue = (pField) => (_Provider._selected[pField] || []);
				});

				test
				(
					'a clause with no CascadeFrom keeps its static DistinctFilter',
					() =>
					{
						const tmpClause = { FilterByColumn: 'Product', DistinctFilter: 'FBV~Deleted~EQ~0' };
						Expect(_View._resolveDistinctFilter(tmpClause, _Provider)).to.equal('FBV~Deleted~EQ~0');
						Expect(_View._distinctCacheKey(tmpClause, _Provider)).to.equal('Product::FBV~Deleted~EQ~0');
					}
				);

				test
				(
					'a parent with nothing selected narrows nothing',
					() =>
					{
						const tmpClause = { FilterByColumn: 'Product', DistinctFilter: 'FBV~Deleted~EQ~0', CascadeFrom: [ 'Site' ] };
						Expect(_View._resolveDistinctFilter(tmpClause, _Provider)).to.equal('FBV~Deleted~EQ~0');
					}
				);

				test
				(
					'a selected parent appends an IN stanza for its column',
					() =>
					{
						_Provider._selected.Site = [ 'Waukesha' ];
						const tmpClause = { FilterByColumn: 'Product', DistinctFilter: 'FBV~Deleted~EQ~0', CascadeFrom: [ 'Site' ] };
						Expect(_View._resolveDistinctFilter(tmpClause, _Provider)).to.equal('FBV~Deleted~EQ~0~FBL~Site~INN~Waukesha');
					}
				);

				test
				(
					'multiple selected values join into one IN list',
					() =>
					{
						_Provider._selected.Site = [ 'Waukesha', 'Franklin' ];
						const tmpClause = { FilterByColumn: 'Product', DistinctFilter: 'FBV~Deleted~EQ~0', CascadeFrom: [ 'Site' ] };
						Expect(_View._resolveDistinctFilter(tmpClause, _Provider)).to.equal('FBV~Deleted~EQ~0~FBL~Site~INN~Waukesha,Franklin');
					}
				);

				test
				(
					'several parents compose, in declaration order',
					() =>
					{
						_Provider._selected.Site = [ 'Waukesha' ];
						_Provider._selected.SampleType = [ 'Production' ];
						const tmpClause = { FilterByColumn: 'Product', DistinctFilter: 'FBV~Deleted~EQ~0', CascadeFrom: [ 'Site', 'SampleType' ] };
						Expect(_View._resolveDistinctFilter(tmpClause, _Provider)).to.equal('FBV~Deleted~EQ~0~FBL~Site~INN~Waukesha~FBL~SampleType~INN~Production');
					}
				);

				test
				(
					'with no static filter the cascade stanza stands alone (no leading separator)',
					() =>
					{
						_Provider._selected.Site = [ 'Waukesha' ];
						const tmpClause = { FilterByColumn: 'Product', CascadeFrom: [ 'Site' ] };
						Expect(_View._resolveDistinctFilter(tmpClause, _Provider)).to.equal('FBL~Site~INN~Waukesha');
					}
				);

				test
				(
					'a value containing a comma is skipped rather than splitting the IN list',
					() =>
					{
						_Provider._selected.Site = [ 'Smith, Inc.' ];
						const tmpClause = { FilterByColumn: 'Product', DistinctFilter: 'FBV~Deleted~EQ~0', CascadeFrom: [ 'Site' ] };
						Expect(_View._resolveDistinctFilter(tmpClause, _Provider)).to.equal('FBV~Deleted~EQ~0');
					}
				);

				test
				(
					'different parent selections produce different cache keys',
					() =>
					{
						const tmpClause = { FilterByColumn: 'Product', DistinctFilter: 'FBV~Deleted~EQ~0', CascadeFrom: [ 'Site' ] };
						_Provider._selected.Site = [ 'Waukesha' ];
						const tmpFirst = _View._distinctCacheKey(tmpClause, _Provider);
						_Provider._selected.Site = [ 'Franklin' ];
						const tmpSecond = _View._distinctCacheKey(tmpClause, _Provider);
						Expect(tmpFirst).to.not.equal(tmpSecond);
					}
				);

				test
				(
					'prepareRecord reads the cascade-scoped cache entry, not the unscoped one',
					() =>
					{
						_Provider._selected.Site = [ 'Waukesha' ];
						_Provider._scopeDistinctCache =
						{
							'Product::FBV~Deleted~EQ~0': [ 'EverythingEverywhere' ],
							'Product::FBV~Deleted~EQ~0~FBL~Site~INN~Waukesha': [ '3/8" Chips', 'Natural Sand' ],
						};
						const tmpRecord =
						{
							Hash: 'ClauseCascade',
							ClauseAddress: '_ActiveFilterState[`Stockpile`].FilterClauses[0]',
							RecordSet: 'Stockpile',
							Type: 'DistinctSelectedValueList',
							FilterByColumn: 'Product',
							Label: 'Product',
							DistinctFilter: 'FBV~Deleted~EQ~0',
							CascadeFrom: [ 'Site' ],
						};
						_View.prepareRecord(tmpRecord);
						Expect(tmpRecord.DistinctOptions.map((pOption) => pOption.Text)).to.deep.equal([ '3/8" Chips', 'Natural Sand' ]);
					}
				);
			}
		);

		suite
		(
			'Quick-filter bar cascade',
			() =>
			{
				/** @type {libPict} */
				let _Pict;
				let _FiltersView;
				let _Provider;

				setup(() =>
				{
					_Pict = new libPict();
					// The PRSP-Filters view constructor builds the whole filter view family, which
					// drags in pict-section-form's dependency manager. These three methods are pure
					// functions of (provider, descriptor), so they are exercised against the
					// prototype with the minimal context they actually read -- no DOM, no form.
					_FiltersView =
					{
						pict: _Pict,
						quickFiltersAutoDefault: true,
						_mountQuickFilterDistinct: () => {},
						resolveCascadedDistinctFilter: libFiltersView.prototype.resolveCascadedDistinctFilter,
						resolveCascadeChildren: libFiltersView.prototype.resolveCascadeChildren,
						refreshCascadeChildren: libFiltersView.prototype.refreshCascadeChildren,
					};
					_Pict.addProvider('RSP-Provider-Stockpile', { RecordSet: 'Stockpile', Entity: 'C182_PD_StockpileVerificationSample' }, libRecordProviderMeadow);
					_Provider = _Pict.providers['RSP-Provider-Stockpile'];
					_Provider._selected = {};
					_Provider.getQuickFilterEntityValue = (pField) => (_Provider._selected[pField] || []);
					_Provider.getQuickFilterDefinitions = () =>
					([
						{ Field: 'Site', ClauseKey: 'Site_AnyOf', Label: 'Site', Control: 'distinct' },
						{ Field: 'Product', ClauseKey: 'Product_AnyOf', Label: 'Product', Control: 'distinct' },
						{ Field: 'BucketDate', ClauseKey: 'BucketDate_Range', Label: 'Date', Control: 'daterange' },
					]);
					_Provider.getFilterClauseSchemaForKey = (pField) =>
					({
						AvailableClauses:
						[
							pField === 'Product'
								? { ClauseKey: 'Product_AnyOf', FilterByColumn: 'Product', DistinctFilter: 'FBV~Deleted~EQ~0', CascadeFrom: [ 'Site' ] }
								: { ClauseKey: `${pField}_AnyOf`, FilterByColumn: pField, DistinctFilter: 'FBV~Deleted~EQ~0' },
						],
					});
				});

				test
				(
					'the quick bar resolves the same filter as the drawer',
					() =>
					{
						_Provider._selected.Site = [ 'Waukesha' ];
						const tmpDescriptor = { FilterByColumn: 'Product', DistinctFilter: 'FBV~Deleted~EQ~0', CascadeFrom: [ 'Site' ] };
						Expect(_FiltersView.resolveCascadedDistinctFilter(_Provider, tmpDescriptor))
							.to.equal('FBV~Deleted~EQ~0~FBL~Site~INN~Waukesha');
					}
				);

				test
				(
					'children of a field are discovered from CascadeFrom',
					() =>
					{
						const tmpChildren = _FiltersView.resolveCascadeChildren(_Provider, 'Site');
						Expect(tmpChildren.map((pChild) => pChild.Field)).to.deep.equal([ 'Product' ]);
					}
				);

				test
				(
					'a field nothing depends on has no children',
					() =>
					{
						Expect(_FiltersView.resolveCascadeChildren(_Provider, 'Product')).to.deep.equal([]);
					}
				);

				test
				(
					'changing the parent clears the child selection so no unsatisfiable filter commits',
					() =>
					{
						const tmpUpserts = [];
						_Provider.upsertQuickFilterEntity = (pField, pClauseKey, pValues) =>
						{
							tmpUpserts.push({ Field: pField, Values: pValues });
							_Provider._selected[pField] = pValues;
						};
						_Provider._selected.Product = [ 'Natural Sand' ];
						_FiltersView.refreshCascadeChildren('Stockpile', 'Dashboard', 'Site');
						Expect(tmpUpserts).to.deep.equal([ { Field: 'Product', Values: [] } ]);
						Expect(_Provider._selected.Product).to.deep.equal([]);
					}
				);
			}
		);
	}
);
