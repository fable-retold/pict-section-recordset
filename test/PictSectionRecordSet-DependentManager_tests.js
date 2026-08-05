/*
	Unit tests for the RecordSet DependentManager — the registry + data layer for one-to-many dependents
	(child entities that carry a foreign key back at a recordset). The shared EntityProvider is stubbed so
	these tests exercise the pure dependent logic (normalization, child listing, FK repoint payloads) with
	no network. This is the one-to-many half of reassociation-on-delete.
*/

const libBrowserEnv = require('browser-env');

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');

const libDependentManager = require('../source/providers/RecordSet-DependentManager.js');

suite
(
	'PictSectionRecordSet DependentManager',
	() =>
	{
		let _Pict;
		let _Manager;
		let _Stub;

		setup(() =>
		{
			libBrowserEnv({ url: 'http://localhost/' });
			_Pict = new libPict();
			_Pict.LogNoisiness = 0;

			_Manager = _Pict.addProvider('RecordSetDependentManager', {}, libDependentManager);

			// Stub the EntityProvider: capture every call, return canned child rows.
			_Stub =
			{
				calls: [],
				ChildRows: [],
				getEntitySet: (pEntity, pFilter, fCallback, pPostfix, pOptions) =>
				{
					_Stub.calls.push([ 'getEntitySet', pEntity, pFilter, pOptions ]);
					return fCallback(null, _Stub.ChildRows.slice());
				},
				updateEntity: (pEntity, pRecord, fCallback) =>
				{
					_Stub.calls.push([ 'updateEntity', pEntity, pRecord ]);
					return fCallback(null, pRecord);
				},
				clearScope: (pScope) =>
				{
					_Stub.calls.push([ 'clearScope', pScope ]);
				},
			};
			_Manager._entityProvider = () => _Stub;
		});

		suite
		(
			'Registration + normalization',
			() =>
			{
				test('addDependents fills the light-config defaults and getDependentsForRecordSet returns them', () =>
				{
					_Manager.addDependents('Item',
						[
							{ Entity: 'Sample', FKField: 'IDItem' },
							{ Entity: 'Reading', FKField: 'IDItem', ChildIDField: 'IDReadingRow', DisplayField: 'Label', Title: 'Readings', SearchFields: [ 'Label', 'Code' ] },
						]);
					const tmpList = _Manager.getDependentsForRecordSet('Item');
					Expect(tmpList.length).to.equal(2);
					Expect(tmpList[0]).to.include({ Entity: 'Sample', FKField: 'IDItem', ChildIDField: 'IDSample', DisplayField: 'Name', Title: 'Sample' });
					Expect(tmpList[0].SearchFields).to.deep.equal([ 'Name' ], 'SearchFields defaults to [DisplayField].');
					Expect(tmpList[1]).to.include({ ChildIDField: 'IDReadingRow', DisplayField: 'Label', Title: 'Readings' });
					Expect(tmpList[1].SearchFields).to.deep.equal([ 'Label', 'Code' ]);
					Expect(_Manager.getDependentsForRecordSet('Nope')).to.deep.equal([], 'unknown recordset -> [].');
				});

				test('addDependents skips entries missing Entity or FKField', () =>
				{
					_Manager.addDependents('Item', [ { Entity: 'Sample', FKField: 'IDItem' }, { Entity: 'Broken' }, { FKField: 'IDItem' } ]);
					Expect(_Manager.getDependentsForRecordSet('Item').length).to.equal(1, 'only the valid dependent is kept.');
				});
			});

		suite
		(
			'Listing + repoint',
			() =>
			{
				test('listDependentRecords filters the child by the FK under the dependent cache scope (NoCount)', async () =>
				{
					const tmpDependent = _Manager.addDependents('Item', [ { Entity: 'Sample', FKField: 'IDItem' } ])[0];
					_Stub.ChildRows = [ { IDSample: 1, IDItem: 5 } ];
					await _Manager.listDependentRecords(tmpDependent, 5);
					const tmpCall = _Stub.calls.find((pCall) => pCall[0] === 'getEntitySet');
					Expect(tmpCall[1]).to.equal('Sample');
					Expect(tmpCall[2]).to.equal('FBV~IDItem~EQ~5', 'children are filtered by the FK column = parent id.');
					Expect(tmpCall[3].Scope).to.equal('RecordSetDependent', 'reads run under a dedicated cache scope so a write can clear them.');
					Expect(tmpCall[3].NoCount).to.equal(true);
				});

				test('repointDependent updates every child FK to the replacement (minimal PUT) and clears the cache', async () =>
				{
					const tmpDependent = _Manager.addDependents('Item', [ { Entity: 'Sample', FKField: 'IDItem' } ])[0];
					_Stub.ChildRows = [ { IDSample: 1, IDItem: 5, Name: 'A' }, { IDSample: 2, IDItem: 5, Name: 'B' } ];
					_Stub.calls = [];
					const tmpResult = await _Manager.repointDependent(tmpDependent, 5, 9);
					Expect(tmpResult).to.deep.equal({ repointed: 2, failed: 0 });
					const tmpUpdates = _Stub.calls.filter((pCall) => pCall[0] === 'updateEntity');
					Expect(tmpUpdates.length).to.equal(2);
					Expect(tmpUpdates[0][1]).to.equal('Sample');
					Expect(tmpUpdates[0][2]).to.deep.equal({ IDSample: 1, IDItem: 9 }, 'minimal update: child id + repointed FK only (no other columns disturbed).');
					Expect(tmpUpdates[1][2]).to.deep.equal({ IDSample: 2, IDItem: 9 });
					const tmpClearIndex = _Stub.calls.findIndex((pCall) => pCall[0] === 'clearScope' && pCall[1] === 'RecordSetDependent');
					Expect(tmpClearIndex).to.be.greaterThan(-1, 'the dependent cache scope is cleared after the writes.');
				});

				test('repointDependent honors a ChildIDField override', async () =>
				{
					const tmpDependent = _Manager.addDependents('Item', [ { Entity: 'Reading', FKField: 'IDItem', ChildIDField: 'IDReadingRow' } ])[0];
					_Stub.ChildRows = [ { IDReadingRow: 77, IDItem: 5 } ];
					_Stub.calls = [];
					await _Manager.repointDependent(tmpDependent, 5, 9);
					const tmpUpdate = _Stub.calls.find((pCall) => pCall[0] === 'updateEntity');
					Expect(tmpUpdate[2]).to.deep.equal({ IDReadingRow: 77, IDItem: 9 }, 'the overridden child id column addresses the row.');
				});

				test('repointDependent is a no-op for a self-repoint', async () =>
				{
					const tmpDependent = _Manager.addDependents('Item', [ { Entity: 'Sample', FKField: 'IDItem' } ])[0];
					_Stub.ChildRows = [ { IDSample: 1, IDItem: 5 } ];
					_Stub.calls = [];
					const tmpResult = await _Manager.repointDependent(tmpDependent, 5, 5);
					Expect(tmpResult).to.deep.equal({ repointed: 0, failed: 0 });
					Expect(_Stub.calls.some((pCall) => pCall[0] === 'updateEntity')).to.equal(false, 'nothing is written for a self-repoint.');
				});

				test('repointDependent surfaces a Meadow ErrorCode body as a failure (not a success)', async () =>
				{
					const tmpDependent = _Manager.addDependents('Item', [ { Entity: 'Sample', FKField: 'IDItem' } ])[0];
					_Stub.ChildRows = [ { IDSample: 1, IDItem: 5 } ];
					_Stub.updateEntity = (pEntity, pRecord, fCallback) => fCallback(null, { ErrorCode: 42 });
					const tmpResult = await _Manager.repointDependent(tmpDependent, 5, 9);
					Expect(tmpResult).to.deep.equal({ repointed: 0, failed: 1 }, 'a non-2xx body is counted as a failure so the caller does not delete.');
				});
			});
	}
);
