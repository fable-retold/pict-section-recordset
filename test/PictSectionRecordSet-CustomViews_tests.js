'use strict';
/*
	Unit tests for the RecordSetCustomViews override hook (RecordSet-RecordBaseView.delegateToCustomView).

	A record set can replace its built-in List / View / Edit / Create screen with an entirely custom
	pict view by setting `RecordSetConfiguration.RecordSetCustomViews = { List, View, Edit, Create }`.
	These tests exercise the delegation helper directly against a stub `this.pict`, so they run fully
	offline with no app harness.
*/

const libBrowserEnv = require('browser-env');
libBrowserEnv();

const Chai = require('chai');
const Expect = Chai.expect;

const libRecordSetBaseView = require('../source/views/RecordSet-RecordBaseView.js');

const delegate = libRecordSetBaseView.prototype.delegateToCustomView;
const makeStubView = (pViews) => ({ pict: { views: pViews || {}, AppData: {}, log: { warn: () => {}, trace: () => {} } } });

suite
(
	'Pict-Section-RecordSet - RecordSetCustomViews override',
	() =>
	{
		test('no RecordSetCustomViews config falls through to the built-in screen (returns false)', () =>
		{
			const tmpStub = makeStubView({});
			const tmpResult = delegate.call(tmpStub, 'Edit', { RecordSet: 'Book' }, { data: { RecordSet: 'Book', GUIDRecord: 'g1' } });
			Expect(tmpResult).to.equal(false);
		});

		test('a configured + registered custom view is delegated to, with the route context', () =>
		{
			let tmpCaptured = null;
			const tmpStub = makeStubView({ 'MyCustomView': { onRecordSetCustomView: (pContext) => { tmpCaptured = pContext; } } });
			const tmpConfig = { RecordSet: 'Book', RecordSetCustomViews: { Edit: 'MyCustomView' } };
			const tmpResult = delegate.call(tmpStub, 'Edit', tmpConfig, { data: { RecordSet: 'Book', GUIDRecord: 'g-abc' } });
			Expect(tmpResult).to.equal(true, 'the route is handled by the custom view');
			Expect(tmpCaptured).to.be.an('object');
			Expect(tmpCaptured.Action).to.equal('Edit');
			Expect(tmpCaptured.RecordSet).to.equal('Book');
			Expect(tmpCaptured.GUIDRecord).to.equal('g-abc');
			Expect(tmpStub.pict.AppData.PictRecordSetCustomView.Action).to.equal('Edit', 'the route context is stashed on AppData for the custom view to read');
		});

		test('a configured view lacking onRecordSetCustomView falls back to render()', () =>
		{
			let tmpRendered = false;
			const tmpStub = makeStubView({ 'MyCustomView': { render: () => { tmpRendered = true; } } });
			const tmpConfig = { RecordSet: 'Book', RecordSetCustomViews: { View: 'MyCustomView' } };
			const tmpResult = delegate.call(tmpStub, 'View', tmpConfig, { data: { RecordSet: 'Book', GUIDRecord: 'g2' } });
			Expect(tmpResult).to.equal(true);
			Expect(tmpRendered).to.equal(true);
		});

		test('a configured-but-unregistered custom view falls through (returns false) and does not throw', () =>
		{
			const tmpStub = makeStubView({});
			const tmpConfig = { RecordSet: 'Book', RecordSetCustomViews: { Edit: 'MissingView' } };
			const tmpResult = delegate.call(tmpStub, 'Edit', tmpConfig, { data: { RecordSet: 'Book' } });
			Expect(tmpResult).to.equal(false);
		});
	}
);
