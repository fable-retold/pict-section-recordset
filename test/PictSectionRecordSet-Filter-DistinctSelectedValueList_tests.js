/*
	Unit tests for the DistinctSelectedValueList filter type:

	  - provider distinct fetch (URL shapes, cache keys, dedupe, back-compat
	    signature, mutation invalidation)
	  - base provider quick-bar mapping (control type, quick-clause preference,
	    RecordSet stamping)
	  - the drawer checkbox-list view (option composition from static Options /
	    cached distinct values / selected-value union, index-based toggling)

	All offline — the REST client is stubbed.
*/

const libBrowserEnv = require('browser-env');
libBrowserEnv({ url: 'http://localhost/' });

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');

const libRecordProviderMeadow = require('../source/providers/RecordSet-RecordProvider-MeadowEndpoints.js');
const libRecordProviderBase = require('../source/providers/RecordSet-RecordProvider-Base.js');
const libFilterDistinctView = require('../source/views/filters/RecordSet-Filter-DistinctSelectedValueList.js');

suite
(
	'PictSectionRecordSet Filter DistinctSelectedValueList Tests',
	() =>
	{
		suite
		(
			'Provider distinct fetch',
			() =>
			{
				/** @type {libPict} */
				let _Pict;
				let _Provider;
				let _RequestedURLs;
				let _ResponseBody;

				setup(() =>
				{
					_Pict = new libPict();
					let _PictEnvironment = new libPict.EnvironmentObject(_Pict);
					_Pict.addProvider('TestProvider', { RecordSet: 'Moisture', Entity: 'C182_Moisture_Day', URLPrefix: '/1.0/PrivateDataLake/Moisture/' }, libRecordProviderMeadow);
					_Provider = _Pict.providers.TestProvider;
					_RequestedURLs = [];
					_ResponseBody = [ { Product: '1/4" Chip' }, { Product: 'Natural Sand' }, { Product: '1/4" Chip' }, { Product: null } ];
					// Stub the entity provider's REST client (the getter returns _EntityProvider when set).
					_Provider._EntityProvider =
					{
						options: {},
						restClient:
						{
							getJSON: (pURL, fCallback) =>
							{
								_RequestedURLs.push(pURL);
								return fCallback(null, { statusCode: 200 }, _ResponseBody);
							},
							postJSON: (pOptions, fCallback) => fCallback(null, { statusCode: 200 }, {}),
							putJSON: (pOptions, fCallback) => fCallback(null, { statusCode: 200 }, {}),
							delJSON: (pOptions, fCallback) => fCallback(null, { statusCode: 200 }, {}),
						},
					};
				});

				test
				(
					'Unfiltered fetch hits the Distinct route, dedupes + null-filters, caches under the bare column key',
					(fDone) =>
					{
						_Provider.getRecordSetColumnDistinct('Product', (pError, pValues) =>
						{
							Expect(pError).to.not.exist;
							Expect(_RequestedURLs[0]).to.equal('/1.0/PrivateDataLake/Moisture/C182_Moisture_Days/Distinct/Product');
							Expect(pValues).to.deep.equal([ '1/4" Chip', 'Natural Sand' ]);
							Expect(_Provider._scopeDistinctCache.Product).to.deep.equal([ '1/4" Chip', 'Natural Sand' ]);
							// Second call resolves from cache — no second request.
							_Provider.getRecordSetColumnDistinct('Product', (pCacheError, pCachedValues) =>
							{
								Expect(_RequestedURLs.length).to.equal(1);
								Expect(pCachedValues).to.deep.equal([ '1/4" Chip', 'Natural Sand' ]);
								fDone();
							});
						});
					}
				);

				test
				(
					'Filtered fetch appends /FilteredTo and caches under the column::filter key',
					(fDone) =>
					{
						_Provider.getRecordSetColumnDistinct('Product', { Filter: 'FBV~Deleted~EQ~0' }, (pError, pValues) =>
						{
							Expect(pError).to.not.exist;
							Expect(_RequestedURLs[0]).to.equal('/1.0/PrivateDataLake/Moisture/C182_Moisture_Days/Distinct/Product/FilteredTo/FBV~Deleted~EQ~0');
							Expect(_Provider._scopeDistinctCache['Product::FBV~Deleted~EQ~0']).to.deep.equal([ '1/4" Chip', 'Natural Sand' ]);
							Expect(_Provider._scopeDistinctCache.Product).to.not.exist;
							fDone();
						});
					}
				);

				test
				(
					'Failed fetch caches an empty list (no retry loops) and reports the error',
					(fDone) =>
					{
						_Provider._EntityProvider.restClient.getJSON = (pURL, fCallback) => fCallback(new Error('boom'), { statusCode: 500 }, null);
						_Provider.getRecordSetColumnDistinct('Product', (pError, pValues) =>
						{
							Expect(pError).to.exist;
							Expect(pValues).to.deep.equal([]);
							Expect(_Provider._scopeDistinctCache.Product).to.deep.equal([]);
							fDone();
						});
					}
				);

				test
				(
					'When the endpoint supports Query, the distinct fetch POSTs to /Query and URL-decodes the filter into the body',
					(fDone) =>
					{
						let _PostedRequests = [];
						_Provider._EntityProvider.resolveEntityQuerySupport = (pEntity, pPrefix, fCb) => fCb(null, true);
						_Provider._EntityProvider.restClient.postJSON = (pOptions, fCallback) =>
						{
							_PostedRequests.push(pOptions);
							return fCallback(null, { statusCode: 200 }, _ResponseBody);
						};
						// A FoxHound stanza carrying URL-encoded characters: a space (%20) and a
						// forward slash (%2F) that only stay intact through a GET because they live
						// in the URL path. The POST body must carry their decoded form.
						_Provider.getRecordSetColumnDistinct('Product', { Filter: 'FBV~Name~LK~%2FNatural%20Sand' }, (pError, pValues) =>
						{
							Expect(pError).to.not.exist;
							// No GET fired — the Query route handled it.
							Expect(_RequestedURLs.length).to.equal(0);
							Expect(_PostedRequests.length).to.equal(1);
							Expect(_PostedRequests[0].url).to.equal('/1.0/PrivateDataLake/Moisture/C182_Moisture_Days/Query');
							Expect(_PostedRequests[0].body).to.deep.equal({ Distinct: true, Columns: 'Product', Filter: 'FBV~Name~LK~/Natural Sand' });
							Expect(pValues).to.deep.equal([ '1/4" Chip', 'Natural Sand' ]);
							fDone();
						});
					}
				);

				test
				(
					'A malformed percent-sequence in the filter is sent verbatim rather than throwing',
					(fDone) =>
					{
						let _PostedRequests = [];
						_Provider._EntityProvider.resolveEntityQuerySupport = (pEntity, pPrefix, fCb) => fCb(null, true);
						_Provider._EntityProvider.restClient.postJSON = (pOptions, fCallback) =>
						{
							_PostedRequests.push(pOptions);
							return fCallback(null, { statusCode: 200 }, _ResponseBody);
						};
						// A lone '%' is not a valid escape sequence; decodeURIComponent would throw.
						_Provider.getRecordSetColumnDistinct('Product', { Filter: 'FBV~Name~LK~100%' }, (pError, pValues) =>
						{
							Expect(pError).to.not.exist;
							Expect(_PostedRequests.length).to.equal(1);
							Expect(_PostedRequests[0].body.Filter).to.equal('FBV~Name~LK~100%');
							fDone();
						});
					}
				);

				test
				(
					'Mutations clear the distinct cache (create / update / delete)',
					async () =>
					{
						await new Promise((fResolve) => _Provider.getRecordSetColumnDistinct('Product', () => fResolve()));
						Expect(_Provider._scopeDistinctCache).to.be.an('object');
						await _Provider.createRecord({ Product: 'New Thing' });
						Expect(_Provider._scopeDistinctCache).to.equal(null);
						await new Promise((fResolve) => _Provider.getRecordSetColumnDistinct('Product', () => fResolve()));
						Expect(_Provider._scopeDistinctCache).to.be.an('object');
						await _Provider.updateRecord({ IDC182_Moisture_Day: 1, Product: 'Edited' });
						Expect(_Provider._scopeDistinctCache).to.equal(null);
						await new Promise((fResolve) => _Provider.getRecordSetColumnDistinct('Product', () => fResolve()));
						await _Provider.deleteRecord({ IDC182_Moisture_Day: 1 });
						Expect(_Provider._scopeDistinctCache).to.equal(null);
					}
				);
			}
		);

		suite
		(
			'Base provider quick-bar mapping',
			() =>
			{
				/** @type {libPict} */
				let _Pict;
				let _Provider;

				setup(() =>
				{
					_Pict = new libPict();
					let _PictEnvironment = new libPict.EnvironmentObject(_Pict);
					_Pict.addProvider('TestBaseProvider', { RecordSet: 'Moisture' }, libRecordProviderBase);
					_Provider = _Pict.providers.TestBaseProvider;
				});

				test
				(
					'DistinctSelectedValueList maps to the distinct control and wins the quick slot',
					() =>
					{
						Expect(_Provider._controlForClauseType('DistinctSelectedValueList')).to.equal('distinct');
						const tmpClauses =
						[
							{ Type: 'StringMatch', ExactMatch: false, ClauseKey: 'Product_Match' },
							{ Type: 'DistinctSelectedValueList', ClauseKey: 'Product_AnyOf' },
						];
						Expect(_Provider._pickQuickClause(tmpClauses).ClauseKey).to.equal('Product_AnyOf');
					}
				);

				test
				(
					'Quick filter upsert round-trips string Values containing quotes and commas; RecordSet is stamped',
					() =>
					{
						_Pict.Bundle._ActiveFilterState = { Moisture: { FilterClauses: [] } };
						_Provider.getFilterClauseSchemaForKey = () => (
						{
							AvailableClauses:
							[
								{ Type: 'DistinctSelectedValueList', FilterByColumn: 'Product', ClauseKey: 'Product_AnyOf', DisplayName: 'Product' },
							],
						});
						const tmpValues = [ '1/4" Chip', 'Chips, Mixed' ];
						_Provider.upsertQuickFilterEntity('Product', 'Product_AnyOf', tmpValues);
						const tmpClause = _Pict.Bundle._ActiveFilterState.Moisture.FilterClauses[0];
						Expect(tmpClause.Values).to.deep.equal(tmpValues);
						Expect(tmpClause.RecordSet).to.equal('Moisture');
						Expect(tmpClause.QuickFilter).to.equal(true);
						// Empty selection removes the clause.
						_Provider.upsertQuickFilterEntity('Product', 'Product_AnyOf', []);
						Expect(_Pict.Bundle._ActiveFilterState.Moisture.FilterClauses.length).to.equal(0);
					}
				);
			}
		);

		suite
		(
			'Drawer checkbox-list view',
			() =>
			{
				/** @type {libPict} */
				let _Pict;
				let _View;

				setup(() =>
				{
					_Pict = new libPict();
					// No EnvironmentObject here — these tests assert real (browser-env) DOM content.
					// Register the Base view too: it owns the shared PRSP-Filter-Base-Template clause
					// wrapper every filter type renders through (in production the PRSP-Filters view
					// constructor registers the whole filter view family).
					_Pict.addView('PRSP-FilterType-Base', {}, require('../source/views/filters/RecordSet-Filter-Base.js'));
					_View = _Pict.addView('PRSP-FilterType-DistinctSelectedValueList', {}, libFilterDistinctView);
				});

				test
				(
					'prepareRecord composes options from a static Options list (no fetch) and flags selections',
					() =>
					{
						const tmpRecord =
						{
							Hash: 'Clause1',
							ClauseAddress: '_ActiveFilterState[`Moisture`].FilterClauses[0]',
							RecordSet: 'Moisture',
							Type: 'DistinctSelectedValueList',
							FilterByColumn: 'Product',
							Label: 'Product',
							Options: [ '1/4" Chip', 'Natural Sand' ],
							Values: [ 'Natural Sand' ],
						};
						_View.prepareRecord(tmpRecord);
						Expect(tmpRecord.DistinctLoading).to.deep.equal([]);
						Expect(tmpRecord.DistinctOptions).to.deep.equal(
						[
							{ Text: '1/4" Chip', OptionIndex: 0, CheckedAttribute: '' },
							{ Text: 'Natural Sand', OptionIndex: 1, CheckedAttribute: 'checked' },
						]);
					}
				);

				test
				(
					'prepareRecord reads the provider distinct cache and unions out-of-list selected values',
					() =>
					{
						_Pict.addProvider('RSP-Provider-Moisture', { RecordSet: 'Moisture', Entity: 'C182_Moisture_Day' }, libRecordProviderMeadow);
						_Pict.providers['RSP-Provider-Moisture']._scopeDistinctCache = { 'Product::FBV~Deleted~EQ~0': [ '1/4" Chip' ] };
						const tmpRecord =
						{
							Hash: 'Clause2',
							ClauseAddress: '_ActiveFilterState[`Moisture`].FilterClauses[0]',
							RecordSet: 'Moisture',
							Type: 'DistinctSelectedValueList',
							FilterByColumn: 'Product',
							DistinctFilter: 'FBV~Deleted~EQ~0',
							Label: 'Product',
							Values: [ 'Retired Product' ],
						};
						_View.prepareRecord(tmpRecord);
						Expect(tmpRecord.DistinctOptions).to.deep.equal(
						[
							{ Text: '1/4" Chip', OptionIndex: 0, CheckedAttribute: '' },
							{ Text: 'Retired Product', OptionIndex: 1, CheckedAttribute: 'checked' },
						]);
					}
				);

				test
				(
					'prepareRecord with an empty cache shows the loading row and fires the distinct fetch',
					() =>
					{
						let tmpFetchedColumns = [];
						_Pict.addProvider('RSP-Provider-HMA', { RecordSet: 'HMA', Entity: 'C182_HMA_Day' }, libRecordProviderMeadow);
						_Pict.providers['RSP-Provider-HMA'].getRecordSetColumnDistinct = (pColumn, pOptions, fCallback) =>
						{
							tmpFetchedColumns.push({ Column: pColumn, Filter: pOptions && pOptions.Filter });
						};
						const tmpRecord =
						{
							Hash: 'Clause3',
							ClauseAddress: '_ActiveFilterState[`HMA`].FilterClauses[0]',
							RecordSet: 'HMA',
							Type: 'DistinctSelectedValueList',
							FilterByColumn: 'MixDesign',
							DistinctFilter: 'FBV~Deleted~EQ~0',
							Label: 'Mix Design',
						};
						_View.prepareRecord(tmpRecord);
						Expect(tmpRecord.DistinctLoading.length).to.equal(1);
						Expect(tmpFetchedColumns).to.deep.equal([ { Column: 'MixDesign', Filter: 'FBV~Deleted~EQ~0' } ]);
					}
				);

				test
				(
					'toggleOption toggles membership in the live clause Values by option index (special characters intact)',
					() =>
					{
						const tmpClause =
						{
							Hash: 'Clause4',
							RecordSet: 'Moisture',
							Type: 'DistinctSelectedValueList',
							FilterByColumn: 'Product',
							Label: 'Product',
							Options: [ '1/4" Chip', `MFG'D Sand` ],
							Values: [],
						};
						// Minimal PRSP-Filters stand-in: resolve the clause address to the live clause.
						_Pict.views['PRSP-Filters'] = { getInformaryScopedValue: () => tmpClause };
						document.body.innerHTML = '<div id="PRSP_Filter_Container_Clause4"></div>';
						_View.toggleOption(null, '_ActiveFilterState[`Moisture`].FilterClauses[0]', 'Clause4', 1);
						Expect(tmpClause.Values).to.deep.equal([ `MFG'D Sand` ]);
						_View.toggleOption(null, '_ActiveFilterState[`Moisture`].FilterClauses[0]', 'Clause4', 0);
						Expect(tmpClause.Values).to.deep.equal([ `MFG'D Sand`, '1/4" Chip' ]);
						// Toggling a checked option un-checks it.
						_View.toggleOption(null, '_ActiveFilterState[`Moisture`].FilterClauses[0]', 'Clause4', 1);
						Expect(tmpClause.Values).to.deep.equal([ '1/4" Chip' ]);
						// The re-render painted real checkbox rows into the container.
						const tmpContainerHTML = document.getElementById('PRSP_Filter_Container_Clause4').innerHTML;
						Expect(tmpContainerHTML).to.contain('prsp-filter-distinct-option');
						Expect(tmpContainerHTML).to.contain(`MFG'D Sand`);
					}
				);
			}
		);
	}
);
