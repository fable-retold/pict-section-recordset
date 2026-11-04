/*
	Unit tests for the add-filter popover's anchoring: the fixed popover follows its trigger while
	the page (or a nested scroll container) scrolls, and stops listening once it closes.
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
		let _Frames;

		const fFlushFrames = () =>
		{
			const tmpFrames = _Frames;
			_Frames = [];
			tmpFrames.forEach((pFrame) => pFrame());
		};

		const fPopoverTop = () => document.getElementById('PRSP_AddFilter_Popover').style.top;

		setup(() =>
		{
			libBrowserEnv({ url: 'http://localhost/' });
			_Frames = [];
			window.requestAnimationFrame = (pCallback) => { _Frames.push(pCallback); return _Frames.length; };
			window.cancelAnimationFrame = () => { _Frames = []; };
			window.innerHeight = 800;
			window.innerWidth = 1200;

			document.body.innerHTML = '';
			const tmpScroller = document.createElement('div');
			tmpScroller.id = 'Scroller';
			const tmpTrigger = document.createElement('button');
			tmpTrigger.id = 'PRSP_Filter_Button_Add';
			tmpScroller.append(tmpTrigger);
			const tmpPopover = document.createElement('div');
			tmpPopover.id = 'PRSP_AddFilter_Popover';
			const tmpPanel = document.createElement('div');
			tmpPanel.className = 'prsp-addfilter-panel';
			tmpPopover.append(tmpPanel);
			document.body.append(tmpScroller, tmpPopover);
			_TriggerTop = 300;
			tmpTrigger.getBoundingClientRect = () =>
				({ top: _TriggerTop, bottom: _TriggerTop + 30, left: 100, right: 200, width: 100, height: 30 });

			// Only the popover methods are under test, so skip the view constructor (it builds form sub-views).
			_View = Object.create(libFiltersView.prototype);
			_View._addFilterOpen = false;
			_View._addFilterExpandedKey = null;
			_View._addFilterTrackHandler = null;
			_View._addFilterTrackFrame = 0;
		});

		test('an open popover repositions under its trigger when the page scrolls', () =>
		{
			_View._addFilterOpen = true;
			_View._paintAddFilterOpenState();
			Expect(fPopoverTop()).to.equal('336px');

			_TriggerTop = 100;
			window.dispatchEvent(new window.Event('scroll'));
			fFlushFrames();
			Expect(fPopoverTop()).to.equal('136px');
		});

		test('a scroll inside a nested container also repositions the popover', () =>
		{
			_View._addFilterOpen = true;
			_View._paintAddFilterOpenState();

			_TriggerTop = 200;
			document.getElementById('Scroller').dispatchEvent(new window.Event('scroll'));
			fFlushFrames();
			Expect(fPopoverTop()).to.equal('236px');
		});

		test('several scroll events in one frame reposition once', () =>
		{
			_View._addFilterOpen = true;
			_View._paintAddFilterOpenState();

			window.dispatchEvent(new window.Event('scroll'));
			window.dispatchEvent(new window.Event('scroll'));
			window.dispatchEvent(new window.Event('resize'));
			Expect(_Frames.length).to.equal(1);
		});

		test('closing the popover stops tracking scroll', () =>
		{
			_View._addFilterOpen = true;
			_View._paintAddFilterOpenState();
			_View.closeAddFilterPopover();
			Expect(_View._addFilterTrackHandler).to.equal(null);

			_TriggerTop = 50;
			window.dispatchEvent(new window.Event('scroll'));
			Expect(_Frames.length).to.equal(0);
			Expect(fPopoverTop()).to.equal('336px');
		});
	}
);
