/*
	Live integration check against the retold-harness bookstore DB — OPT-IN (not part of `npm test`).

	Run it with the harness up:   npm run test-live      (or: node Live-Reassociation-Check.js)
	Override the endpoint:        HARNESS_URL=http://host:port/1.0/ npm run test-live

	Exercises the reassociation-on-delete data layer end-to-end with REAL Meadow endpoints + a REAL DB:
	  - repointJoins (M2M) with duplicate dedup
	  - repointDependent (one-to-many Review -> Book) with minimal-PUT preservation
	  - the reconcile checklist's manager ops (createJoin / removeJoin / listAssociatedRecords / fetchSidePage)
	  - the bulk-delete provider path (EntityProvider.deleteEntity -> soft delete)
	Creates ZZTEST_-marked records and soft-deletes them at the end.
*/
const libPict = require('pict');
const libAssociationManager = require('./source/providers/RecordSet-AssociationManager.js');
const libDependentManager = require('./source/providers/RecordSet-DependentManager.js');

const URL_PREFIX = process.env.HARNESS_URL || 'http://localhost:8086/1.0/';
let _pass = 0, _fail = 0;
const check = (pLabel, pCond) => { if (pCond) { _pass++; console.log(`  ✓ ${pLabel}`); } else { _fail++; console.log(`  ✗ FAIL: ${pLabel}`); } };

const P = new libPict();
P.LogNoisiness = 0;
P.EntityProvider.options.urlPrefix = URL_PREFIX;
const EP = P.EntityProvider;

// Promisified EntityProvider helpers.
const create = (e, r) => new Promise((res, rej) => EP.createEntity(e, r, (err, b) => err ? rej(err) : res(b)));
const readSet = (e, f) => new Promise((res) => EP.getEntitySet(e, f, (err, r) => res(err ? [] : (r || []))));
const del = (e, id) => new Promise((res) => EP.deleteEntity(e, id, () => res()));

const _manager = P.addProvider('RecordSetAssociationManager', {}, libAssociationManager);
_manager.addAssociation('BookAuthor',
	{
		JoinEntity: 'BookAuthorJoin',
		DefaultJoinValues: { IDCustomer: 1 },
		SideA: { RecordSet: 'Book',   IDField: 'IDBook',   DisplayField: 'Title', SearchFields: [ 'Title', 'ISBN' ] },
		SideB: { RecordSet: 'Author', IDField: 'IDAuthor', DisplayField: 'Name',  SearchFields: [ 'Name' ] },
	});
const _dependents = P.addProvider('RecordSetDependentManager', {}, libDependentManager);
const _reviewDep = _dependents.addDependents('Book', [ { Entity: 'Review', FKField: 'IDBook' } ])[0];

const _cleanup = { BookAuthorJoin: [], Book: [], Author: [], Review: [] };

(async () =>
{
	// ============ Test A: repointJoins (M2M) with dedup ============
	console.log('\n[A] repointJoins (M2M) — move an author\'s books to a replacement, dedup a collision');
	const tmpAFrom = await create('Author', { Name: 'ZZTEST_from', IDCustomer: 1 });
	const tmpATo = await create('Author', { Name: 'ZZTEST_to', IDCustomer: 1 });
	_cleanup.Author.push(tmpAFrom.IDAuthor, tmpATo.IDAuthor);
	const tmpB1 = await create('Book', { Title: 'ZZTEST_B1', IDCustomer: 1 });
	const tmpB2 = await create('Book', { Title: 'ZZTEST_B2', IDCustomer: 1 });
	const tmpB3 = await create('Book', { Title: 'ZZTEST_B3', IDCustomer: 1 });
	_cleanup.Book.push(tmpB1.IDBook, tmpB2.IDBook, tmpB3.IDBook);

	// from-author linked to B1,B2,B3; to-author already linked to B2 (the collision).
	await _manager.createJoin('BookAuthor', 'Author', tmpAFrom.IDAuthor, tmpB1.IDBook);
	await _manager.createJoin('BookAuthor', 'Author', tmpAFrom.IDAuthor, tmpB2.IDBook);
	await _manager.createJoin('BookAuthor', 'Author', tmpAFrom.IDAuthor, tmpB3.IDBook);
	await _manager.createJoin('BookAuthor', 'Author', tmpATo.IDAuthor, tmpB2.IDBook);

	const tmpResult = await _manager.repointJoins('BookAuthor', 'Author', tmpAFrom.IDAuthor, tmpATo.IDAuthor);
	console.log('  repointJoins result:', JSON.stringify(tmpResult));
	check('result is { repointed:2, deletedDuplicate:1, failed:0 }', tmpResult.repointed === 2 && tmpResult.deletedDuplicate === 1 && tmpResult.failed === 0);

	const tmpFromJoins = await readSet('BookAuthorJoin', `FBV~IDAuthor~EQ~${tmpAFrom.IDAuthor}`);
	check('from-author has 0 joins left', tmpFromJoins.length === 0);
	const tmpToJoins = await readSet('BookAuthorJoin', `FBV~IDAuthor~EQ~${tmpATo.IDAuthor}`);
	const tmpToBooks = tmpToJoins.map((j) => j.IDBook).sort((a, b) => a - b);
	const tmpExpected = [ tmpB1.IDBook, tmpB2.IDBook, tmpB3.IDBook ].sort((a, b) => a - b);
	check('to-author linked to exactly {B1,B2,B3} (no B2 duplicate)', tmpToJoins.length === 3 && JSON.stringify(tmpToBooks) === JSON.stringify(tmpExpected));
	tmpToJoins.forEach((j) => _cleanup.BookAuthorJoin.push(j.IDBookAuthorJoin));

	// ============ Test B: repointDependent (one-to-many Review -> Book) ============
	console.log('\n[B] repointDependent (1-to-many) — move a book\'s reviews to a replacement book');
	const tmpBx = await create('Book', { Title: 'ZZTEST_Bx', IDCustomer: 1 });
	const tmpBy = await create('Book', { Title: 'ZZTEST_By', IDCustomer: 1 });
	_cleanup.Book.push(tmpBx.IDBook, tmpBy.IDBook);
	const tmpR1 = await create('Review', { Text: 'ZZTEST_review_one', Rating: 5, IDBook: tmpBx.IDBook, IDUser: 0, IDCustomer: 1 });
	const tmpR2 = await create('Review', { Text: 'ZZTEST_review_two', Rating: 3, IDBook: tmpBx.IDBook, IDUser: 0, IDCustomer: 1 });
	_cleanup.Review.push(tmpR1.IDReview, tmpR2.IDReview);

	const tmpDepResult = await _dependents.repointDependent(_reviewDep, tmpBx.IDBook, tmpBy.IDBook);
	console.log('  repointDependent result:', JSON.stringify(tmpDepResult));
	check('result is { repointed:2, failed:0 }', tmpDepResult.repointed === 2 && tmpDepResult.failed === 0);
	const tmpBxReviews = await readSet('Review', `FBV~IDBook~EQ~${tmpBx.IDBook}`);
	const tmpByReviews = await readSet('Review', `FBV~IDBook~EQ~${tmpBy.IDBook}`);
	check('old book has 0 reviews, new book has 2', tmpBxReviews.length === 0 && tmpByReviews.length === 2);
	const tmpMoved = tmpByReviews.find((r) => r.IDReview === tmpR1.IDReview);
	check('minimal-PUT preserved the review Text + Rating', !!tmpMoved && tmpMoved.Text === 'ZZTEST_review_one' && tmpMoved.Rating === 5);

	// ============ Test C: reconcile checklist manager ops ============
	console.log('\n[C] reconcile ops — fetchSidePage + listAssociatedRecords + removeJoin');
	const tmpPage = await _manager.fetchSidePage('BookAuthor', 'Book', 'ZZTEST', 0, 10);
	check('fetchSidePage(other side=Book, search "ZZTEST") returns the test books', tmpPage.records.length >= 5);
	const tmpAssoc = await _manager.listAssociatedRecords('BookAuthor', 'Author', tmpATo.IDAuthor);
	check('listAssociatedRecords decorates joins with the Book title', tmpAssoc.length === 3 && tmpAssoc.every((i) => typeof i.Display === 'string' && i.Display.startsWith('ZZTEST_B')));
	// Reconcile "uncheck" path: remove one join, confirm it drops.
	await _manager.removeJoin('BookAuthor', tmpAssoc[0].JoinRecord);
	const tmpAfterRemove = await _manager.listAssociatedRecords('BookAuthor', 'Author', tmpATo.IDAuthor);
	check('removeJoin drops exactly one association', tmpAfterRemove.length === 2);

	// ============ Test D: bulk-delete provider path (soft delete) ============
	console.log('\n[D] bulk delete — EntityProvider.deleteEntity soft-deletes the record');
	const tmpBz = await create('Book', { Title: 'ZZTEST_Bz_delete', IDCustomer: 1 });
	await del('Book', tmpBz.IDBook);
	const tmpDeleted = await readSet('Book', `FBV~IDBook~EQ~${tmpBz.IDBook}~FBL~Deleted~INN~0,1`);
	check('deleted book row has Deleted=1', tmpDeleted.length === 1 && tmpDeleted[0].Deleted === 1);

	// ============ Cleanup ============
	console.log('\n[cleanup] soft-deleting ZZTEST records…');
	for (const j of _cleanup.BookAuthorJoin) { await del('BookAuthorJoin', j); }
	for (const r of _cleanup.Review) { await del('Review', r); }
	for (const b of _cleanup.Book) { await del('Book', b); }
	for (const a of _cleanup.Author) { await del('Author', a); }
	// Also sweep any joins still hanging off the test authors.
	for (const a of _cleanup.Author) { const js = await readSet('BookAuthorJoin', `FBV~IDAuthor~EQ~${a}`); for (const j of js) { await del('BookAuthorJoin', j.IDBookAuthorJoin); } }

	console.log(`\n==== ${_pass} passed, ${_fail} failed ====`);
	process.exit(_fail > 0 ? 1 : 0);
})().catch((e) => { console.error('\nINTEGRATION ERROR:', e && e.message, e && e.stack); process.exit(2); });
