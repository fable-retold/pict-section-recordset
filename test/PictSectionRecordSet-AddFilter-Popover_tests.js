/*
	Unit tests for the add-filter popover's anchoring: on open it moves to <body> and is placed in
	document coordinates against its trigger, so it moves with the page; on close it goes back to its
	slot, and a popover left on <body> by an earlier open is swept away.
*/

const libBrowserEnv = require('browser-env');

const Chai = require('chai');
const Expect = Chai.expect;

const libFiltersView = require('../source/views/RecordSet-Filters.js');

suite
(
	'PictSectionRecordSet Add-Filter Popover Anchoring',
	() =>
	{
		let _View;
		let _TriggerTop;

		const fPopover = () => document.getElementById('PRSP_AddFilter_Popover');

		setup(() =>
		{
			libBrowserEnv({ url: 'http://localhost/' });
			window.innerHeight = 800;
			window.innerWidth = 1200;
			window.scrollX = 0;
			window.scrollY = 0;

			document.body.innerHTML = '';
			const tmpSlot = document.createElement('div');
			tmpSlot.className = 'prsp-filters-add';
			const tmpTrigger = document.createElement('button');
			tmpTrigger.id = 'PRSP_Filter_Button_Add';
			const tmpPopover = document.createElement('div');
			tmpPopover.id = 'PRSP_AddFilter_Popover';
			tmpPopover.className = 'prsp-addfilter-pop';
			const tmpPanel = document.createElement('div');
			tmpPanel.className = 'prsp-addfilter-panel';
			tmpPopover.append(tmpPanel);
			tmpSlot.append(tmpTrigger, tmpPopover);
			document.body.append(tmpSlot);
			_TriggerTop = 300;
			tmpTrigger.getBoundingClientRect = () =>
				({ top: _TriggerTop, bottom: _TriggerTop + 30, left: 100, right: 200, width: 100, height: 30 });

			// Only the popover methods are under test, so skip the view constructor (it builds form sub-views).
			_View = Object.create(libFiltersView.prototype);
			_View._addFilterOpen = false;
			_View._addFilterExpandedKey = null;
		});

		test('opening moves the popover to <body> and places it under its trigger', () =>
		{
			_View._addFilterOpen = true;
			_View._paintAddFilterOpenState();
			Expect(fPopover().parentElement).to.equal(document.body);
			Expect(fPopover().classList.contains('open')).to.equal(true);
			Expect(fPopover().style.top).to.equal('336px');
			Expect(fPopover().style.left).to.equal('100px');
		});

		test('placement is in document coordinates, so the page scroll offset is added', () =>
		{
			window.scrollY = 500;
			window.scrollX = 20;
			_TriggerTop = 100;
			_View._addFilterOpen = true;
			_View._paintAddFilterOpenState();
			Expect(fPopover().style.top).to.equal('636px');
			Expect(fPopover().style.left).to.equal('120px');
		});

		test('closing returns the popover to its slot and clears what the portal wrote', () =>
		{
			_View._addFilterOpen = true;
			_View._paintAddFilterOpenState();
			_View.closeAddFilterPopover();
			Expect(fPopover().parentElement.className).to.equal('prsp-filters-add');
			Expect(fPopover().classList.contains('open')).to.equal(false);
			Expect(fPopover().style.top).to.equal('');
		});

		test('a popover left on <body> is swept when the slot has been re-rendered', () =>
		{
			_View._addFilterOpen = true;
			_View._paintAddFilterOpenState();
			const tmpStale = fPopover();
			const tmpFresh = document.createElement('div');
			tmpFresh.id = 'PRSP_AddFilter_Popover';
			tmpFresh.className = 'prsp-addfilter-pop';
			document.querySelector('.prsp-filters-add').append(tmpFresh);

			_View._sweepPortaledAddFilterPopover(null);
			Expect(tmpStale.isConnected).to.equal(false);
			Expect(fPopover()).to.equal(tmpFresh);
		});
	}
);
