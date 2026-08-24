/*
	Unit tests for the deferred, single-flight entity-schema loading in the
	MeadowEndpoints record provider.

	Background: each record provider used to fetch `<Entity>/Schema` inline in its
	`onInitializeAsync`, blocking the provider's init callback. Because the
	application initializes providers through a serial queue, an app registering N
	record sets paid N schema round-trips back-to-back at startup. The fetch is now
	deferred (kicked off in the background, pulled in on demand by
	`getRecordSchema()`) and made single-flight so the background load and any
	on-demand read share one round-trip and one (append-only) filter-schema build.

	These tests mock the entity provider's rest client, so they run fully offline
	(no bookstore API on :8086 required) and target the new behavior directly.
*/

const libBrowserEnv = require('browser-env');

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');
const libMeadowEndpointsProvider = require('../source/providers/RecordSet-RecordProvider-MeadowEndpoints.js');

// A representative /Schema response: a synthetic AutoIdentity PK, a string column,
// and an integer metric — enough for initializeFilterSchema() to derive clauses.
const SCHEMA =
{
	title: 'Widget', type: 'object', required: [],
	properties:
	{
		IDWidget: { type: 'integer', size: 'Default' },
		Name:     { type: 'string',  size: 'Default' },
		Count:    { type: 'integer', size: 'int' }
	},
	MeadowSchema:
	{
		Scope: 'Widget', DefaultIdentifier: 'IDWidget',
		Schema:
		[
			{ Column: 'IDWidget', Type: 'AutoIdentity' },
			{ Column: 'Name',     Type: 'String' },
			{ Column: 'Count',    Type: 'Integer' }
		]
	}
};

suite
(
	'PictSectionRecordSet Deferred Schema Loading Tests',
	() =>
	{
		let _Pict;

		setup(() =>
		{
			libBrowserEnv({ url: 'http://localhost/' });
			_Pict = new libPict();
			_Pict.LogNoisiness = 0;
		});

		// Build an isolated MeadowEndpoints provider (addProvider only instantiates —
		// it does not initialize, so no background fetch fires) with a mock entity
		// provider whose rest client counts /Schema calls and answers asynchronously.
		const buildProvider = (pOptions, pClientBehavior) =>
		{
			const tmpProvider = _Pict.addProvider(`RSP-Test-${_Pict.getUUID()}`, Object.assign({ Entity: 'Widget', URLPrefix: '/1.0/' }, pOptions || {}), libMeadowEndpointsProvider);
			const tmpCounter = { count: 0, lastURL: null };
			tmpProvider._EntityProvider =
			{
				primeEntityCapabilityFromSchema: () => {},
				restClient:
				{
					getJSON: (pURL, fCallback) =>
					{
						tmpCounter.count++;
						tmpCounter.lastURL = pURL;
						// Resolve on a later tick so concurrent callers overlap before the first settles.
						setTimeout(() => (pClientBehavior || ((cb) => cb(null, { statusCode: 200 }, SCHEMA)))(fCallback), 5);
					}
				}
			};
			return { provider: tmpProvider, counter: tmpCounter };
		};

		test('concurrent getRecordSchema() calls share a single /Schema round-trip (single-flight)', async () =>
		{
			const { provider, counter } = buildProvider();
			const tmpResults = await Promise.all(
			[
				provider.getRecordSchema(),
				provider.getRecordSchema(),
				provider.getRecordSchema(),
				provider.getRecordSchema(),
				provider.getRecordSchema()
			]);
			Expect(counter.count).to.equal(1, 'five concurrent schema reads must share one network round-trip');
			Expect(counter.lastURL).to.equal('/1.0/Widget/Schema', 'the fetch targets the entity /Schema endpoint');
			tmpResults.forEach((pSchema) => Expect(pSchema).to.equal(provider._Schema, 'every caller resolves to the one loaded schema'));
		});

		test('the append-only filter schema is derived exactly once (no duplicate clauses)', async () =>
		{
			const { provider } = buildProvider();
			await Promise.all([ provider.getRecordSchema(), provider.getRecordSchema() ]);
			const tmpClauses = (provider._FilterSchema.Count || {}).AvailableClauses || [];
			const tmpKeys = tmpClauses.map((pClause) => pClause.ClauseKey);
			Expect(tmpKeys.length).to.be.greaterThan(0, 'the integer column has filter clauses');
			Expect(new Set(tmpKeys).size).to.equal(tmpKeys.length, 'no duplicate filter clauses — the filter schema is built once, not once per caller');
		});

		test('a manifest-provided schema resolves with no network round-trip (ProvidedSchema fast-path)', async () =>
		{
			const { provider, counter } = buildProvider({ ProvidedSchema: SCHEMA });
			const tmpSchema = await provider.getRecordSchema();
			Expect(tmpSchema).to.equal(SCHEMA, 'the provided schema is used directly');
			Expect(counter.count).to.equal(0, 'no /Schema round-trip when the manifest supplies the schema');
			Expect((provider._FilterSchema.Count || {}).AvailableClauses || []).to.have.length.greaterThan(0, 'the filter schema still derives from the provided schema');
		});

		test('a failed schema load clears the single-flight handle so a later read retries', async () =>
		{
			let tmpAttempt = 0;
			const { provider, counter } = buildProvider(null, (fCallback) =>
			{
				tmpAttempt++;
				// Fail the first attempt, succeed on the retry.
				return (tmpAttempt === 1) ? fCallback(new Error('boom')) : fCallback(null, { statusCode: 200 }, SCHEMA);
			});

			let tmpFirstError = null;
			try { await provider.getRecordSchema(); }
			catch (pError) { tmpFirstError = pError; }
			Expect(tmpFirstError, 'the first read surfaces the fetch error').to.be.an('error');
			Expect(provider._Schema, 'no schema is cached after a failure').to.equal(null);
			Expect(provider._SchemaInitPromise, 'the failed single-flight handle is cleared so a retry can run').to.equal(null);

			const tmpSchema = await provider.getRecordSchema();
			Expect(tmpSchema).to.be.an('object', 'a later read retries and succeeds');
			Expect(counter.count).to.equal(2, 'the retry issues a fresh /Schema round-trip');
		});
	}
);
