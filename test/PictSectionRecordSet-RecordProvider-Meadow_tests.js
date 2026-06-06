/*
	Unit tests for PictSectionRecordSet Basic

*/

// This is temporary, but enables unit tests
const libBrowserEnv = require('browser-env');

const libPictApplication = require('pict-application');
const libPictView = require('pict-view');

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');

const libPictSectionRecordSet = require('../source/Pict-Section-RecordSet.js');

class DoNothingApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		pOptions.AutoRenderMainViewportViewAfterInitialize = false;
		pOptions.AutoRenderViewsAfterInitialize = false;
		super(pFable, pOptions, pServiceHash);

		let resolveFunc;
		/** @type {Promise & { resolve?: () => void }} */
		this._initialized = new Promise(function (resolve)
		{
			resolveFunc = resolve;
		});
		this._initialized.resolve = resolveFunc;
	}

	get iniitalized()
	{
		return this._initialized;
	}

	onAfterInitialize()
	{
		this._initialized.resolve();
		return super.onAfterInitialize();
	}
}

class DoNothingView extends libPictView
{
	constructor(pPict, pOptions)
	{
		super(pPict, pOptions);
	}
}

suite
(
	'PictSectionRecordSet RecordProvider MeadowEndpoints Tests',
	() =>
	{
		setup(() =>
		{
			libBrowserEnv({ url: 'http://localhost/' });
		});

		suite
			(
				'Basic Basic Tests',
				() =>
				{
					let _Pict;
					setup(async () =>
					{
						_Pict = new libPict();
						_Pict.LogNoisiness = 2;
						let _PictEnvironment = new libPict.EnvironmentObject(_Pict);

						let _Application = new DoNothingApplication(_Pict, {});
						_Pict.addProvider('BooksProvider', { Entity: 'Book', URLPrefix: 'http://localhost:8086/1.0/' }, require('../source/providers/RecordSet-RecordProvider-MeadowEndpoints.js'));
						await new Promise((resolve, reject) => _Application.initializeAsync((error) =>
						{
							if (error)
							{
								return reject(error);
							}
							resolve();
						}));
					});

					test('getRecord by ID', async () =>
					{
						const book = await _Pict.providers.BooksProvider.getRecord(1);
						Expect(book).to.be.an('object', 'Book should be an object.');
						Expect(book).to.have.property('IDBook', 1, 'Book should have an id of 1.');
						Expect(book).to.have.property('GUIDBook', 'ca811611-59c9-4b4a-9864-df5145f7785d', 'Book should have a guid of "ca811611-59c9-4b4a-9864-df5145f7785d".');
						Expect(book.Title).to.equal('Angels & Demons', 'Book should have a title of "Angels & Demons".');
					}); // ca811611-59c9-4b4a-9864-df5145f7785d

					test('getRecord by GUID', async () =>
					{
						const book = await _Pict.providers.BooksProvider.getRecord('ca811611-59c9-4b4a-9864-df5145f7785d');
						Expect(book).to.be.an('object', 'Book should be an object.');
						Expect(book).to.have.property('IDBook', 1, 'Book should have an id of 1.');
						Expect(book).to.have.property('GUIDBook', 'ca811611-59c9-4b4a-9864-df5145f7785d', 'Book should have a guid of "ca811611-59c9-4b4a-9864-df5145f7785d".');
						Expect(book.Title).to.equal('Angels & Demons', 'Book should have a title of "Angels & Demons".');
					});

					test('getRecords with no options', async () =>
					{
						const { Records: books } = await _Pict.providers.BooksProvider.getRecords({ });
						Expect(books).to.be.an('array', 'Books should be an array.');
						Expect(books.length).to.equal(250, 'Books should have one record.');
					});

					test('getRecords with pagination', async () =>
					{
						const { Records: books } = await _Pict.providers.BooksProvider.getRecords({ Offset: 1, PageSize: 1 });
						Expect(books).to.be.an('array', 'Books should be an array.');
						Expect(books.length).to.equal(1, 'Books should have one record.');
						const book = books[0];
						Expect(book).to.be.an('object', 'Book should be an object.');
						Expect(book).to.have.property('IDBook', 2, 'Book should have an id of 2.');
						Expect(book).to.have.property('GUIDBook', 'c854b3f1-539a-47fa-acca-c1b90629c220', 'Book should have a guid of "c854b3f1-539a-47fa-acca-c1b90629c220".');
						Expect(book.Title).to.equal(`Harry Potter and the Philosopher's Stone`, `Book should have a title of "Harry Potter and the Philosopher's Stone".`);
					});

					test('getRecords with filter', async () =>
					{
						const { Records: books } = await _Pict.providers.BooksProvider.getRecords({ FilterString: 'FBV~ISBN~GE~804139024~FSF~ISBN~ASC~0' });
						Expect(books).to.be.an('array', 'Books should be an array.');
						const book = books[0];
						Expect(book).to.be.an('object', 'Book should be an object.');
						Expect(book.ISBN).to.equal('804139024', 'Book should have an ISBN of "804139024".');
					});

					test('getRecordSetCount', async () =>
					{
						const { Count: count } = await _Pict.providers.BooksProvider.getRecordSetCount({ });
						Expect(count).to.be.greaterThan(0, 'Count should be greater than 0.');
					});

					test('getRecordSetCount with filter', async () =>
					{
						const { Count: count } = await _Pict.providers.BooksProvider.getRecordSetCount({ FilterString: 'FBV~ISBN~GE~804139024~FSF~ISBN~ASC~0' });
						Expect(count).to.be.greaterThan(0, 'Count should be greater than 0.');
					});

					test('getRecordSetCount with filter to one record', async () =>
					{
						const { Count: count } = await _Pict.providers.BooksProvider.getRecordSetCount({ FilterString: 'FBV~ISBN~EQ~804139024' });
						Expect(count).to.equal(1, 'Count should be equal to 1.');
					});

					test('getRecordsInline with no options', async () =>
					{
						const { Records: books } = await _Pict.providers.BooksProvider.getRecordsInline();
						Expect(books).to.be.an('array', 'Books should be an array.');
						Expect(books.length).to.equal(250, 'Books should have one record.');
					});

					test('getRecordsInline with pagination', async () =>
					{
						const { Records: books } = await _Pict.providers.BooksProvider.getRecordsInline('', 1, 1);
						Expect(books).to.be.an('array', 'Books should be an array.');
						Expect(books.length).to.equal(1, 'Books should have one record.');
						const book = books[0];
						Expect(book).to.be.an('object', 'Book should be an object.');
						Expect(book).to.have.property('IDBook', 2, 'Book should have an id of 2.');
						Expect(book).to.have.property('GUIDBook', 'c854b3f1-539a-47fa-acca-c1b90629c220', 'Book should have a guid of "c854b3f1-539a-47fa-acca-c1b90629c220".');
						Expect(book.Title).to.equal(`Harry Potter and the Philosopher's Stone`, `Book should have a title of "Harry Potter and the Philosopher's Stone".`);
					});

					test('getRecordsInline with filter', async () =>
					{
						const { Records: books } = await _Pict.providers.BooksProvider.getRecordsInline('FBV~ISBN~GE~804139024~FSF~ISBN~ASC~0');
						Expect(books).to.be.an('array', 'Books should be an array.');
						const book = books[0];
						Expect(book).to.be.an('object', 'Book should be an object.');
						Expect(book.ISBN).to.equal('804139024', 'Book should have an ISBN of "804139024".');
					});

					test('createRecord and deleteRecord', async () =>
					{
						const book = await _Pict.providers.BooksProvider.createRecord({ Title: 'Test Book', ISBN: '1234567890' });
						Expect(book).to.be.an('object', 'Book should be an object.');
						Expect(book.IDBook).to.be.greaterThan(0, 'Book should have an id greater than 0.');
						book.Title = 'Test Book 2';
						const updartedBook = await _Pict.providers.BooksProvider.updateRecord(book);
						Expect(updartedBook).to.be.an('object', 'Book should be an object.');
						Expect(updartedBook.IDBook).to.equal(book.IDBook, 'Book should have the same id.');
						Expect(updartedBook.Title).to.equal('Test Book 2', 'Book should have a title of "Test Book 2".');
						await _Pict.providers.BooksProvider.deleteRecord(book);
						const existenceCheck = await _Pict.providers.BooksProvider.getRecord(book.IDBook);
						Expect(existenceCheck.Error).to.equal('Record not Found');
					});

					test('recordSchema', async () =>
					{
						const schema = await _Pict.providers.BooksProvider.getRecordSchema();
						Expect(schema).to.be.an('object', 'Schema should be an object.');
						Expect(Object.keys(schema).length).to.be.greaterThan(0, 'Schema should have properties.');
					});

					test('temp', async () =>
					{
						const libPictDynamicFormDependencyManager = require('pict-section-form').PictDynamicFormDependencyManager;
						_Pict.addAndInstantiateSingletonService('PictDynamicFormDependencyManager', libPictDynamicFormDependencyManager.default_configuration, libPictDynamicFormDependencyManager);
						const filterView = new (require('../source/views/RecordSet-Filters.js'))(_Pict);
						const ser = await filterView.serializeFilterExperience([ { Type: 'fake', Value: 'valyou' } ]);
						const deser = await filterView.deserializeFilterExperience(ser);
						Expect(deser).to.be.an('array', 'Deserialized filter experience should be an array.');
						Expect(deser).to.deep.equal([ { Type: 'fake', Value: 'valyou' } ], 'Deserialized filter experience should match the original.');
					});

					test('filter schema - the primary key keeps its filters, with the picker resolving the recordset entity (not a peeled table name)', () =>
					{
						const tmpProvider = _Pict.providers.BooksProvider;
						if (!_Pict.providers.FilterManager) { _Pict.providers.FilterManager = { filters: {} }; }
						// A private-data-lake table's /Schema: an AutoIdentity PK that *looks*
						// like a foreign key (IDC182_X), a real Integer FK (IDAuthor), plus a
						// date column and a metric.
						tmpProvider._Schema =
						{
							title: 'C182_Moisture_Day', type: 'object', required: [],
							properties:
							{
								IDC182_Moisture_Day: { type: 'integer', size: 'Default' },
								IDAuthor:            { type: 'integer', size: 'int' },
								BucketDate:          { type: 'string',  size: 'Default' },
								TotalSamples:        { type: 'integer', size: 'int' }
							},
							MeadowSchema:
							{
								Scope: 'C182_Moisture_Day', DefaultIdentifier: 'IDC182_Moisture_Day',
								Schema:
								[
									{ Column: 'IDC182_Moisture_Day', Type: 'AutoIdentity' },
									{ Column: 'IDAuthor',            Type: 'Integer' },
									{ Column: 'BucketDate',          Type: 'DateTime' },
									{ Column: 'TotalSamples',        Type: 'Integer' }
								]
							}
						};
						tmpProvider._FilterSchema = {};
						tmpProvider.initializeFilterSchema();
						const tmpClausesFor = (pField) => (tmpProvider._FilterSchema[pField] || {}).AvailableClauses || [];
						const tmpTypesFor = (pField) => tmpClausesFor(pField).map((pClause) => pClause.Type);
						const tmpPickerFor = (pField) => tmpClausesFor(pField).find((pClause) => pClause.Type === 'InternalJoinSelectedValueList');

						// The PK keeps its useful numeric filters (Exact Match / In Range)...
						Expect(tmpTypesFor('IDC182_Moisture_Day')).to.include('NumericRange', 'the PK keeps its In Range filter');
						Expect(tmpTypesFor('IDC182_Moisture_Day')).to.include('NumericMatch', 'the PK keeps its Exact Match filter');
						// ...AND a Selected-Records picker — but resolved to the recordset's declared
						// Entity, NOT a table name peeled from the column (that peel is the defect).
						Expect(tmpPickerFor('IDC182_Moisture_Day'), 'the PK still offers a Selected-Records picker').to.exist;
						Expect(tmpPickerFor('IDC182_Moisture_Day').RemoteTable).to.equal(tmpProvider.options.Entity, 'the PK picker references the recordset entity');
						Expect(tmpPickerFor('IDC182_Moisture_Day').RemoteTable).to.not.equal('C182_Moisture_Day', 'the PK picker must not use the peeled physical table name');
						Expect(tmpPickerFor('IDC182_Moisture_Day').URLPrefix).to.equal(tmpProvider.options.URLPrefix, 'the picker carries the recordset URLPrefix so the value-list fetch routes to the right endpoint');

						// A real foreign key still resolves by peeling its referenced entity, and
						// stays picker-only (no numeric range on a foreign-key column).
						Expect(tmpPickerFor('IDAuthor').RemoteTable).to.equal('Author', 'a real foreign key resolves to its referenced entity by name');
						Expect(tmpTypesFor('IDAuthor')).to.not.include('NumericRange', 'a real foreign key stays a picker, not a numeric range');

						// Ordinary columns resolve to their usual widgets.
						Expect(tmpTypesFor('BucketDate')).to.include('DateRange', 'a date column gets a date-range filter');
						Expect(tmpTypesFor('TotalSamples')).to.include('NumericRange', 'a numeric column gets a numeric-range filter');
					});
				});
	}
);
