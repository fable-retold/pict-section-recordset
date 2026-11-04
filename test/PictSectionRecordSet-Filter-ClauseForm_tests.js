/*
	Unit tests for the per-clause form: each clause body is its own <form>, so the browser's native
	Enter-to-submit commits the typed value (change fires before submit) and applies the search.
	Ids are namespaced per clause, the hidden submit is bound to its own form by id, and a clause type
	that renders a form of its own keeps a plain body so forms never nest.
*/

const libBrowserEnv = require('browser-env');

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');
const libFilterBase = require('../source/views/filters/RecordSet-Filter-Base.js');
const libFilterStringMatch = require('../source/views/filters/RecordSet-Filter-StringMatch.js');
const libFilterEntityReferenceBase = require('../source/views/filters/RecordSet-Filter-EntityReference-Base.js');

suite
(
	'PictSectionRecordSet Filter Clause Form',
	() =>
	{
		let _Pict;
		let _StringMatchView;

		const fRenderClause = (pHash) => _Pict.parseTemplateByHash('PRSP-Filter-Base-Template',
			{ Hash: pHash, RecordSet: 'Book', ViewContext: 'List', Type: 'StringMatch', ClauseDescriptor: {} }, null, [ _StringMatchView ]);

		const fMount = (pHTML) =>
		{
			const tmpHost = document.createElement('div');
			tmpHost.innerHTML = pHTML;
			document.body.append(tmpHost);
			return tmpHost;
		};

		setup(() =>
		{
			libBrowserEnv({ url: 'http://localhost/' });
			document.body.innerHTML = '';
			_Pict = new libPict();
			_Pict.LogNoisiness = 0;
			_Pict.addView('PRSP-FilterType-Base', {}, libFilterBase);
			_StringMatchView = _Pict.addView('PRSP-FilterType-StringMatch', {}, libFilterStringMatch);
		});

		test('a clause body is a form with an id namespaced by the clause hash', () =>
		{
			const tmpHost = fMount(fRenderClause('Title-StringMatch-1'));
			const tmpForm = tmpHost.querySelector('form.prsp-filter-body');
			Expect(tmpForm).to.not.equal(null);
			Expect(tmpForm.id).to.equal('PRSP_Filter_Clause_Form_Title-StringMatch-1');
		});

		test('the hidden submit is bound to its own clause form by id', () =>
		{
			const tmpHost = fMount(fRenderClause('Title-StringMatch-1'));
			const tmpButton = tmpHost.querySelector('#PRSP_Filter_Clause_Submit_Title-StringMatch-1');
			Expect(tmpButton.getAttribute('type')).to.equal('submit');
			Expect(tmpButton.getAttribute('form')).to.equal('PRSP_Filter_Clause_Form_Title-StringMatch-1');
			Expect(tmpButton.hasAttribute('hidden')).to.equal(true);
			Expect(tmpButton.form).to.equal(tmpHost.querySelector('form.prsp-filter-body'));
		});

		test('submit cancels the native submit and stops propagation before applying the search', () =>
		{
			const tmpHost = fMount(fRenderClause('Title-StringMatch-1'));
			const tmpOnSubmit = tmpHost.querySelector('form.prsp-filter-body').getAttribute('onsubmit');
			Expect(tmpOnSubmit.indexOf('event.preventDefault(); event.stopPropagation();')).to.equal(0);
			Expect(tmpOnSubmit).to.contain(`handleSearch(event, 'Book', 'List')`);
		});

		test('two clauses on one page each own a separate form and submit', () =>
		{
			const tmpHost = fMount(fRenderClause('Title-StringMatch-1') + fRenderClause('Genre-StringMatch-2'));
			const tmpForms = tmpHost.querySelectorAll('form.prsp-filter-body');
			Expect(tmpForms.length).to.equal(2);
			Expect(tmpHost.querySelector('#PRSP_Filter_Clause_Submit_Title-StringMatch-1').form).to.equal(tmpForms[0]);
			Expect(tmpHost.querySelector('#PRSP_Filter_Clause_Submit_Genre-StringMatch-2').form).to.equal(tmpForms[1]);
		});

		test('rendered inside a host form, the hidden submit never becomes that form\'s submit button', () =>
		{
			const tmpHostForm = document.createElement('form');
			tmpHostForm.id = 'HostForm';
			document.body.append(tmpHostForm);
			// The parser drops a <form> start tag inside an open form, so the clause form disappears here.
			tmpHostForm.innerHTML = fRenderClause('Title-StringMatch-1');
			const tmpButton = document.getElementById('PRSP_Filter_Clause_Submit_Title-StringMatch-1');
			Expect(tmpButton.form).to.not.equal(tmpHostForm);
		});

		test('a clause type whose own template carries a form keeps a plain body', () =>
		{
			const tmpTableMode = Object.create(libFilterEntityReferenceBase.prototype);
			tmpTableMode.options = {};
			Expect(tmpTableMode.getClauseBodyTemplate()).to.equal('PRSP-Filter-Base-Body');

			const tmpInputMode = Object.create(libFilterEntityReferenceBase.prototype);
			tmpInputMode.options = { EntityInputType: 'Picker' };
			Expect(tmpInputMode.getClauseBodyTemplate()).to.equal('PRSP-Filter-Base-Body-Form');
		});
	}
);
