const libPictRecordSet = require('../../source/Pict-Section-RecordSet.js');
// pict-section-picker (public package) + its pict-section-form 'Picker' InputType adapter —
// demonstrates the entity filters rendering a picker instead of the built-in table UI.
const libPictSectionPicker = require('pict-section-picker');
const libPictPickerForm = require('pict-section-picker/form');
// pict-section-modal — the host modal the association editors use for remove confirmations + toasts.
const libPictSectionModal = require('pict-section-modal');
const libPictRouter = require('pict-router');
const libPictTemplatePreprocessor = require('pict-template-preprocessor');

// Views
const libViewLogin = require('./views/PictView-Bookstore-Login.js');
const libViewLayout = require('./views/PictView-Bookstore-Layout.js');
const libViewNavigation = require('./views/PictView-Bookstore-Navigation.js');
const libViewDashboard = require('./views/PictView-Bookstore-Dashboard.js');

class BookstoreApplication extends libPictRecordSet.PictRecordSetApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		// Router provider — add BEFORE recordset initialization so the RecordSet router reuses it.
		// SkipRouteResolveOnAdd is set in the config so routes only resolve after the layout renders.
		this.pict.addProvider('PictRouter',
			require('./providers/PictRouter-Bookstore.json'),
			libPictRouter);

		// Login view (extends pict-section-login)
		this.pict.addView('Bookstore-Login', libViewLogin.default_configuration, libViewLogin);

		// Layout shell (sidebar navigation + content area)
		this.pict.addView('Bookstore-Layout', libViewLayout.default_configuration, libViewLayout);

		// Sidebar navigation
		this.pict.addView('Bookstore-Navigation', libViewNavigation.default_configuration, libViewNavigation);

		// Dashboard view
		this.pict.addView('Bookstore-Dashboard', libViewDashboard.default_configuration, libViewDashboard);

		// Content views (About, Legal) — pure JSON config, no JavaScript needed
		this.pict.addView('Bookstore-About-View', require('./views/PictView-Bookstore-Content-About.json'));
		this.pict.addView('Bookstore-Legal-View', require('./views/PictView-Bookstore-Content-Legal.json'));

		// Template Preprocessor — register the service type so it can be toggled on/off
		this.pict.addServiceType('PictTemplatePreprocessor', libPictTemplatePreprocessor);

		// Track preprocessor state
		this._preprocessorInstance = null;

		// Check localStorage for saved preference and activate if enabled
		this._initPreprocessorFromStorage();
	}

	// ===== Template Preprocessor Toggle =====

	/**
	 * Read the saved preprocessor preference from localStorage and
	 * instantiate the preprocessor if it was previously enabled.
	 * @private
	 */
	_initPreprocessorFromStorage()
	{
		try
		{
			let tmpSaved = (typeof localStorage !== 'undefined') ? localStorage.getItem('bookstore-preprocessor-enabled') : null;
			if (tmpSaved === 'true')
			{
				this.enablePreprocessor();
			}
		}
		catch (pError)
		{
			// localStorage may not be available (e.g., SSR or privacy mode)
			this.pict.log.warn('Preprocessor: Could not read localStorage preference.');
		}
	}

	/**
	 * Enable the template preprocessor. Instantiates the service and
	 * saves the preference to localStorage.
	 */
	enablePreprocessor()
	{
		if (this._preprocessorInstance)
		{
			// Already active
			return;
		}

		this._preprocessorInstance = this.pict.instantiateServiceProviderWithoutRegistration('PictTemplatePreprocessor');

		try
		{
			if (typeof localStorage !== 'undefined')
			{
				localStorage.setItem('bookstore-preprocessor-enabled', 'true');
			}
		}
		catch (pError)
		{
			// Ignore storage errors
		}

		this.pict.log.info('Template Preprocessor: ENABLED');
	}

	/**
	 * Disable the template preprocessor. Unwraps template functions,
	 * clears the cache, and saves the preference to localStorage.
	 */
	disablePreprocessor()
	{
		if (!this._preprocessorInstance)
		{
			// Already inactive
			return;
		}

		this._preprocessorInstance.unwrapTemplateFunctions();
		this._preprocessorInstance.clear();
		this._preprocessorInstance = null;

		try
		{
			if (typeof localStorage !== 'undefined')
			{
				localStorage.setItem('bookstore-preprocessor-enabled', 'false');
			}
		}
		catch (pError)
		{
			// Ignore storage errors
		}

		this.pict.log.info('Template Preprocessor: DISABLED');
	}

	/**
	 * Toggle the preprocessor on or off.
	 *
	 * @return {boolean} True if the preprocessor is now enabled
	 */
	togglePreprocessor()
	{
		if (this._preprocessorInstance)
		{
			this.disablePreprocessor();
		}
		else
		{
			this.enablePreprocessor();
		}

		// Re-render navigation to update the toggle UI
		if (this.pict.views['Bookstore-Navigation'])
		{
			this.pict.views['Bookstore-Navigation'].render();
		}

		return !!this._preprocessorInstance;
	}

	/**
	 * Check if the preprocessor is currently active.
	 *
	 * @return {boolean} True if active
	 */
	isPreprocessorEnabled()
	{
		return !!this._preprocessorInstance;
	}

	onAfterInitializeAsync(fCallback)
	{
		// Register the picker + its pict-section-form 'Picker' InputType, then opt the entity-reference
		// filters into it so they render a searchable picker instead of the legacy table UI.
		if (!this.pict.providers['Pict-Section-Picker'])
		{
			this.pict.addProvider('Pict-Section-Picker', libPictSectionPicker.default_configuration, libPictSectionPicker);
		}
		libPictPickerForm.registerPickerInputType(this.pict);

		// Register the host modal so association remove buttons get a real confirm dialog (and toasts),
		// per the pict convention of never using native confirm()/alert().
		if (!this.pict.views['Pict-Section-Modal'])
		{
			this.pict.addView('Pict-Section-Modal', libPictSectionModal.default_configuration, libPictSectionModal);
		}
		[ 'InternalJoinSelectedValue', 'InternalJoinSelectedValueList', 'ExternalJoinSelectedValue', 'ExternalJoinSelectedValueList' ].forEach((pType) =>
		{
			const tmpView = this.pict.views['PRSP-FilterType-' + pType];
			if (tmpView) { tmpView.options.EntityInputType = 'Picker'; }
		});

		// Render the login form first
		this.pict.views['Bookstore-Login'].render();

		// Inject CSS so the login section styling is applied immediately
		this.pict.CSSMap.injectCSS();

		// Check if a session already exists (e.g. cookie from a previous visit).
		// The login view's onSessionChecked hook will call showProtectedApp()
		// if a valid session is found.
		this.pict.views['Bookstore-Login'].checkSession();

		return super.onAfterInitializeAsync(fCallback);
	}

	// ===== Application-Level Navigation =====

	/**
	 * Switch from the login screen to the protected application.
	 * Called by the login view after a successful login or session check.
	 */
	showProtectedApp()
	{
		// Hide the login container
		let tmpLoginElements = this.pict.ContentAssignment.getElement('#Bookstore-Login-Container');
		if (tmpLoginElements && tmpLoginElements.length > 0)
		{
			tmpLoginElements[0].style.display = 'none';
		}

		// Show the protected app container
		let tmpAppElements = this.pict.ContentAssignment.getElement('#Bookstore-App-Container');
		if (tmpAppElements && tmpAppElements.length > 0)
		{
			tmpAppElements[0].style.display = 'block';
		}

		// Render the layout shell (triggers Navigation, CSS injection, and router resolve)
		this.pict.views['Bookstore-Layout'].render();

		// Deep-link restore: on a cold load with a PSRS List hash, the recordset router resolves
		// during app init — before this shell exists — so the list renders into a missing
		// container (and Navigo caches the route as resolved, so it will not re-fire). The list
		// view stashed its render arguments on that first pass; mount the container and replay
		// the render in full. (Read/Create deep links are not restored — list URLs are the ones
		// people reload and share.)
		if (window.location.hash && window.location.hash.indexOf('#/PSRS/') === 0)
		{
			let tmpContentElements = this.pict.ContentAssignment.getElement('#Bookstore-Content-Container');
			if (tmpContentElements && tmpContentElements.length > 0)
			{
				tmpContentElements[0].innerHTML = '<div id="PRSP_Container"></div>';
			}
			const tmpListView = this.pict.views['RSP-RecordSet-List'];
			if (tmpListView && tmpListView._lastListRenderArgs)
			{
				tmpListView[tmpListView._lastListRenderArgs.Method](...tmpListView._lastListRenderArgs.Args);
			}
		}
	}

	/**
	 * Switch from the protected application back to the login screen.
	 * Called by the doLogout() method after the session is destroyed.
	 */
	showLogin()
	{
		// Clear session data
		this.pict.AppData.Session = null;

		// Hide the protected app container
		let tmpAppElements = this.pict.ContentAssignment.getElement('#Bookstore-App-Container');
		if (tmpAppElements && tmpAppElements.length > 0)
		{
			tmpAppElements[0].style.display = 'none';
		}

		// Show the login container
		let tmpLoginElements = this.pict.ContentAssignment.getElement('#Bookstore-Login-Container');
		if (tmpLoginElements && tmpLoginElements.length > 0)
		{
			tmpLoginElements[0].style.display = 'block';
		}

		// Reset the login view state and re-render
		let tmpLoginView = this.pict.views['Bookstore-Login'];
		if (tmpLoginView)
		{
			tmpLoginView.authenticated = false;
			tmpLoginView.sessionData = null;
			tmpLoginView.initialRenderComplete = false;
			tmpLoginView.render();
		}
	}

	/**
	 * Render a specific content view into the content container.
	 * Used by the router for custom views (Dashboard, About, Legal).
	 *
	 * @param {string} pViewIdentifier - The view identifier to render
	 */
	showView(pViewIdentifier)
	{
		if (pViewIdentifier in this.pict.views)
		{
			this.pict.views[pViewIdentifier].render();
		}
		else
		{
			this.pict.log.warn('View [' + pViewIdentifier + '] not found; falling back to Dashboard.');
			this.pict.views['Bookstore-Dashboard'].render();
		}
	}

	/**
	 * Show a recordset view (List, Read, Create, Dashboard) for a given entity.
	 * Ensures the PRSP_Container exists inside the content area, then navigates.
	 *
	 * @param {string} pRecordSet - The recordset name (e.g. 'Book', 'Author')
	 * @param {string} pVerb - The verb (e.g. 'List', 'Read', 'Create', 'Dashboard')
	 */
	showRecordSet(pRecordSet, pVerb)
	{
		// Ensure the recordset container exists in the content area
		let tmpContentElements = this.pict.ContentAssignment.getElement('#Bookstore-Content-Container');
		if (tmpContentElements && tmpContentElements.length > 0)
		{
			tmpContentElements[0].innerHTML = '<div id="PRSP_Container"></div>';
		}

		// Navigate to the PSRS route
		let tmpRoute = '/PSRS/' + pRecordSet + '/' + pVerb;
		this.pict.providers.RecordSetRouter.navigate(tmpRoute);
	}

	// Single-argument wrappers for router templates (the {~LV:...~} macro
	// does not reliably pass multiple arguments with backtick-delimited params).
	showBookList() { return this.showRecordSet('Book', 'List'); }
	showAuthorList() { return this.showRecordSet('Author', 'List'); }
	showBookStoreList() { return this.showRecordSet('BookStore', 'List'); }

	/**
	 * Show the bulk association screen for an anchor recordset + association — mounts the recordset
	 * container, then navigates to the PSRS Associate route.
	 *
	 * @param {string} pRecordSet - The anchor recordset (e.g. 'BookStore')
	 * @param {string} pAssociation - The association hash (e.g. 'BookStoreCatalog')
	 */
	showBulkAssociate(pRecordSet, pAssociation)
	{
		let tmpContentElements = this.pict.ContentAssignment.getElement('#Bookstore-Content-Container');
		if (tmpContentElements && tmpContentElements.length > 0)
		{
			tmpContentElements[0].innerHTML = '<div id="PRSP_Container"></div>';
		}
		this.pict.providers.RecordSetRouter.navigate('/PSRS/' + pRecordSet + '/Associate/' + pAssociation);
	}

	// No-arg wrapper for the router template (see note above on backtick-delimited multi-args).
	showBookStoreCatalogBulk() { return this.showBulkAssociate('BookStore', 'BookStoreCatalog'); }

	/**
	 * Show the dual-column matrix (cross-link) screen for an association.
	 *
	 * @param {string} pAssociation - The association hash (e.g. 'BookStoreCatalog')
	 * @param {string} pLeftRecordSet - Which side goes on the left (e.g. 'Book')
	 */
	showMatrixAssociate(pAssociation, pLeftRecordSet)
	{
		let tmpContentElements = this.pict.ContentAssignment.getElement('#Bookstore-Content-Container');
		if (tmpContentElements && tmpContentElements.length > 0)
		{
			tmpContentElements[0].innerHTML = '<div id="PRSP_Container"></div>';
		}
		this.pict.providers.RecordSetRouter.navigate('/PSRS/AssociateMatrix/' + pAssociation + '/' + pLeftRecordSet);
	}

	// No-arg wrapper for the router template — Books (left) × Stores (right).
	showBooksStoresMatrix() { return this.showMatrixAssociate('BookStoreCatalog', 'Book'); }

	/**
	 * Show the bulk-unlink screen for an association anchored on one side.
	 *
	 * @param {string} pAssociation - The association hash (e.g. 'BookStoreCatalog')
	 * @param {string} pAnchorRecordSet - The anchor side (e.g. 'BookStore' to unlink books from a store)
	 */
	showUnlinkAssociate(pAssociation, pAnchorRecordSet)
	{
		let tmpContentElements = this.pict.ContentAssignment.getElement('#Bookstore-Content-Container');
		if (tmpContentElements && tmpContentElements.length > 0)
		{
			tmpContentElements[0].innerHTML = '<div id="PRSP_Container"></div>';
		}
		this.pict.providers.RecordSetRouter.navigate('/PSRS/AssociateUnlink/' + pAssociation + '/' + pAnchorRecordSet);
	}

	// No-arg wrapper for the router template — unlink books from a chosen store.
	showStoreBooksUnlink() { return this.showUnlinkAssociate('BookStoreCatalog', 'BookStore'); }

	/**
	 * Navigate to a route using pict-router.
	 *
	 * @param {string} pRoute - The route path (e.g. '/Dashboard', '/Books')
	 */
	navigateTo(pRoute)
	{
		this.pict.providers.PictRouter.navigate(pRoute);
	}

	/**
	 * Log out and return to the login screen.
	 * Called from the navigation sidebar logout button.
	 */
	doLogout()
	{
		let tmpLoginView = this.pict.views['Bookstore-Login'];
		if (tmpLoginView)
		{
			tmpLoginView.logout(() =>
			{
				this.showLogin();
			});
		}
		else
		{
			this.showLogin();
		}
	}
}

module.exports = BookstoreApplication;

module.exports.default_configuration = require('./Bookstore-Application-Configuration.json');

module.exports.default_configuration.pict_configuration = (
	{
		"Product": "Bookstore RecordSet Application",

		"PictApplicationConfiguration":
			{
				"AutoRenderMainViewportViewAfterInitialize": false
			},

		"Manifests":
		{
			"Book-View":
			{
				"Form": "BookViewManifest",
				"Scope": "Book-View",
				"Descriptors":
				{
					"BookDetails.Title":
					{
						"Name": "Title",
						"Hash": "ViewBookTitle",
						"DataType": "String",
						"PictForm":
						{
							"Row": "1",
							"Section": "BookView",
							"Group": "BookView"
						}
					},
					"BookDetails.Genre":
					{
						"Name": "Genre",
						"Hash": "ViewBookGenre",
						"DataType": "String",
						"PictForm":
						{
							"Row": "1",
							"Section": "BookView",
							"Group": "BookView"
						}
					},
					"BookDetails.ISBN":
					{
						"Name": "ISBN",
						"Hash": "ViewBookISBN",
						"DataType": "String",
						"PictForm":
						{
							"Row": "2",
							"Section": "BookView",
							"Group": "BookView"
						}
					},
					"BookDetails.PublicationYear":
					{
						"Name": "Publication Year",
						"Hash": "ViewBookYear",
						"DataType": "Number",
						"PictForm":
						{
							"Row": "2",
							"Section": "BookView",
							"Group": "BookView"
						}
					}
				},
				"Sections":
				[
					{
						"Name": "Book Details",
						"Hash": "BookView",
						"Solvers": [],
						"ShowTitle": false,
						"Groups": [
							{
								"Name": "Book Details",
								"Hash": "BookView",
								"Rows": [],
								"RecordSetSolvers": [],
								"ShowTitle": false
							}
						]
					}
				]
			},
			"Author-View":
			{
				"Form": "AuthorViewManifest",
				"Scope": "Author-View",
				"Descriptors":
				{
					"AuthorDetails.Name":
					{
						"Name": "Author Name",
						"Hash": "ViewAuthorName",
						"DataType": "String",
						"PictForm":
						{
							"Row": "1",
							"Section": "AuthorView",
							"Group": "AuthorView"
						}
					}
				},
				"Sections":
				[
					{
						"Name": "Author Details",
						"Hash": "AuthorView",
						"Solvers": [],
						"ShowTitle": false,
						"Groups": [
							{
								"Name": "Author Details",
								"Hash": "AuthorView",
								"Rows": [],
								"RecordSetSolvers": [],
								"ShowTitle": false
							}
						]
					}
				]
			}
		},

		"Filters":
		{
			"ExternalJoinBookByAuthor":
			{
				"Label": "Author's Name",
				"Type": "ExternalJoinStringMatch",
				"ExternalFilterByColumns": [ "Name" ],
				"DisplayName": "Author's Name",

				"CoreConnectionColumn": "IDBook",

				"JoinTable": "BookAuthorJoin",
				"JoinTableExternalConnectionColumn": "IDAuthor",
				"JoinTableCoreConnectionColumn": "IDBook",

				"ExternalFilterByTable": "Author",
				"ExternalFilterByTableConnectionColumn": "IDAuthor"
			},
			"ExternalJoinBookBySelectedAuthors":
			{
				"Label": "Authors",
				"Type": "ExternalJoinSelectedValueList",
				"ExternalFilterByColumns": [ "Name", "GUIDAuthor" ],
				"DisplayName": "Authors (select)",

				"MaximumSelectedExternalRecords": 5,
				"ExternalRecordDisplayTemplate": "{~D:Record.Data.Name~}",

				"CoreConnectionColumn": "IDBook",

				"JoinTable": "BookAuthorJoin",
				"JoinTableExternalConnectionColumn": "IDAuthor",
				"JoinTableCoreConnectionColumn": "IDBook",

				"ExternalFilterByTable": "Author",
				"ExternalFilterByTableConnectionColumn": "IDAuthor"
			}
		},

		// Joined-entity associations, defined ONCE and symmetrically. Each recordset opts in per side
		// via a RecordSetReadTabs { "Type": "Association" } entry (the embeddable editor tab) and/or a
		// RecordSetBulkAssociations entry (the bulk "Assign …" screen). Side defaults are light:
		// Entity<-RecordSet, IDField<-ID<Entity>, DisplayField<-Name, SearchFields<-[DisplayField].
		"Associations":
		{
			// Book <-> Author over the existing BookAuthorJoin. Opted in from BOTH sides (Book→Authors
			// tab and Author→Books tab) to demonstrate the per-side, independent opt-in.
			// Each side's "Title" names THAT side's records, so it reads naturally when that side is the
			// "other side" being managed (Book's tab shows "Authors"; Author's tab shows "Books").
			"BookAuthor":
			{
				"JoinEntity": "BookAuthorJoin",
				// ChipFields show extra data as disambiguation chips in the picker + the list — e.g. the
				// ISBN tells apart three books with the same Title. (ISBN is also searchable.)
				"SideA": { "RecordSet": "Book",   "IDField": "IDBook",   "DisplayField": "Title", "SearchFields": [ "Title", "ISBN" ], "ChipFields": [ "ISBN", { "Field": "PublicationYear", "Label": "Year" } ], "Title": "Books" },
				"SideB": { "RecordSet": "Author", "IDField": "IDAuthor", "DisplayField": "Name",  "SearchFields": [ "Name" ],  "Title": "Authors" }
			},
			// Book <-> BookStore over the clean BookStoreCatalogJoin (which books a store carries).
			// Drives the BookStore "Catalog" tab, the Book "Stores" tab, and the bulk screen.
			"BookStoreCatalog":
			{
				"JoinEntity": "BookStoreCatalogJoin",
				// TableColumns drive the Bulk Link matrix's record tables — pick complex records by several
				// columns (the chips elsewhere are for the quick add controls). Each is a field name or
				// { Key, DisplayName, Template? }.
				"SideA": { "RecordSet": "BookStore", "IDField": "IDBookStore", "DisplayField": "Name",  "SearchFields": [ "Name", "City" ], "ChipFields": [ "City", "State" ],
					"TableColumns": [ "Name", "City", "State", "Country", { "Key": "Postal", "DisplayName": "Postal", "DefaultHidden": true } ], "Title": "Stores" },
				"SideB": { "RecordSet": "Book",      "IDField": "IDBook",      "DisplayField": "Title", "SearchFields": [ "Title", "ISBN" ], "ChipFields": [ "ISBN", { "Field": "PublicationYear", "Label": "Year" } ],
					"TableColumns": [ "Title", "ISBN", { "Key": "PublicationYear", "DisplayName": "Year" }, "Genre",
						{ "Key": "Type", "DisplayName": "Type", "DefaultHidden": true }, { "Key": "Language", "DisplayName": "Language", "DefaultHidden": true } ], "Title": "Books" }
			}
		},

		// Record preview cards — a small, meaningful card per entity, rendered in an anchored popover when
		// a {~RecordCard:RecordSet^id^label~} trigger is clicked (in a list cell, a record view, an
		// association row, a dashboard). Pure configuration: a Title/Subtitle + a list of labeled values
		// (each a field name OR a {~...~} template), plus the record's most important Actions.
		"RecordCards":
		{
			"Author":
			{
				"Title": "Name",
				"Fields":
				[
					{ "Label": "Author ID", "Value": "IDAuthor" }
				],
				"Actions":
				[
					{ "Label": "View", "Icon": "User", "Route": "#/PSRS/Author/View/{~D:Record.GUIDAuthor~}" }
				]
			},
			"Book":
			{
				"Title": "Title",
				"Subtitle": "{~D:Record.Genre~}",
				"Fields":
				[
					{ "Label": "ISBN", "Value": "ISBN" },
					{ "Label": "Year", "Value": "PublicationYear" },
					{ "Label": "Language", "Value": "Language" }
				],
				"Actions":
				[
					{ "Label": "View", "Icon": "Eye", "Route": "#/PSRS/Book/View/{~D:Record.GUIDBook~}" }
				]
			}
		},

		"DefaultRecordSetConfigurations":
		[
			{
				"RecordSet": "Book",

				"RecordSetType": "MeadowEndpoint",
				"RecordSetMeadowEntity": "Book",

				// Bulk + advanced delete (List "Delete records" button + Read-view Delete). Book is a side of
				// both BookAuthor and BookStoreCatalog, so "Reassign & delete" repoints those joins to a
				// replacement book before deleting a duplicate.
				"RecordSetAllowBulkDelete": true,
				"RecordSetAdvancedDelete": true,

				// One-to-many dependents: child entities that carry a foreign key back at Book. Advanced
				// delete repoints these to the replacement book BEFORE deleting a duplicate (so a Review or
				// Pricing row is never orphaned). The harness schema also exposes Pricing / Inventory — add
				// them here the same way once their FK columns are confirmed.
				"RecordSetDependents":
				[
					{ "Entity": "Review", "FKField": "IDBook", "Title": "Reviews", "DisplayField": "Title" }
				],

				"RecordSetIgnoreFilterFields": [ "Deleted", "DeletingIDUser", "DeleteDate", "UpdateDate" ],

				// Quick Filters — a curated, one-click bar above the full "Add filter" list. (Without this
				// the bar is clever-derived from the schema.) Showcases all four control types: text
				// (Title), distinct-values dropdown (Genre, via RecordSetFieldFilterClauses below),
				// date range (CreateDate), and entity picker (CreatingIDUser → User).
				"QuickFilters": [ "Title", "Genre", { "Field": "CreateDate", "Label": "Added" }, { "Field": "CreatingIDUser", "Label": "Added by" } ],

				// Per-column clause overrides — Genre offers a distinct-values dropdown ("any of the
				// checked genres", options fetched from /1.0/Books/Distinct/Genre) first, with the
				// fuzzy text match still available from the Add Filter popover. The override replaces
				// the auto-generated clauses for the column, so list both.
				"RecordSetFieldFilterClauses":
				{
					"Genre":
					[
						{
							"FilterKey": "Genre",
							"ClauseKey": "Genre_Distinct",
							"Label": "Genre",
							"DisplayName": "Any of selected Genres",
							"Type": "DistinctSelectedValueList",
							"FilterByColumn": "Genre",
							"Ordinal": 1
						},
						{
							"FilterKey": "Genre",
							"ClauseKey": "Genre_Match_Fuzzy",
							"Label": "Genre Partial Match",
							"DisplayName": "Partial Match",
							"Type": "StringMatch",
							"FilterByColumn": "Genre",
							"ExactMatch": false,
							"Ordinal": 2
						}
					]
				},

				// Row interaction: clicking a row opens its default (View) link; actions move into a ⋯ hover menu.
				"RowClickOpensRecord": true,

				// Column chooser: a "Columns" button above the table — curated columns first (Language
				// ships hidden-but-available via DefaultHidden), then the remaining scalar schema
				// columns under "More columns", then the audit columns.
				"RecordSetListColumnChooser": true,

				// Show-deleted: a quick-bar toggle that enumerates soft-deleted rows too (pairs with
				// the audit Deleted / Deleted on / Deleted by columns in the chooser).
				"RecordSetListShowDeletedFilter": true,

				"RecordSetListColumns": [
					{
						"Key": "Title",
						"DisplayName": "Title"
					},
					{
						"Key": "Genre",
						"DisplayName": "Genre"
					},
					{
						"Key": "ISBN",
						"DisplayName": "ISBN"
					},
					{
						"Key": "PublicationYear",
						"DisplayName": "Year"
					},
					{
						"Key": "Language",
						"DisplayName": "Language",
						"DefaultHidden": true
					}
				],

				"FilterExperiences":
				{
					"FilterByAuthor":
					{
						"Ordinal": 1,
						"FilterCriteriaHash": "FilterRecordsetByAuthor",
						"Default": true
					},
					"AdvancedSearch":
					{
						"Ordinal": 2,
						"FilterCriteriaHash": "FilterRecordsetAdvancedSearch"
					}
				},

				"RecordSetReadManifestOnly": true,
				"RecordSetReadDefaultManifestView": "Book-View",
				"RecordSetReadManifestsView": [ "Book-View" ],

				// Split read view: the record details stay in a resizable LEFT pane while the
				// association editors (Authors, Stores) are tabs in the RIGHT pane — so the record is
				// always visible next to the association interface. (Use "Tab" instead to make the
				// record its own tab.) Each Association tab is a light opt-in referencing an entry in
				// the top-level Associations registry; the manager resolves "this side" (Book) from the
				// rendering recordset.
				"ReadLayout": "Split",
				"RecordSetReadSplitLeftWidth": "40%",
				"RecordSetReadTabTitle": "Book",
				"RecordSetReadTabs":
				[
					{
						"Type": "Association",
						"Association": "BookAuthor",
						"Title": "Authors"
					},
					{
						"Type": "Association",
						"Association": "BookStoreCatalog",
						"Title": "Stores"
					}
				],

				"RecordSetListHasExtraColumns": true,
				"RecordSetListExtraColumnsHeaderTemplate": "<th style=\"border-bottom: 1px solid var(--theme-color-border-default, #ccc); padding: 5px; background-color: var(--theme-color-background-tertiary, #f2f2f2); color: var(--theme-color-text-primary, #333);\">Cover</th>",
				"RecordSetListExtraColumnRowTemplate": "<td><img src=\"{~D:Record.Data.ImageURL~}\" style=\"max-width:60px; max-height:80px;\"></td>",

				"SearchFields": [ "Title" ],

				"RecordSetURLPrefix": "/1.0/"
			},
			{
				"RecordSet": "Author",

				"RecordSetType": "MeadowEndpoint",
				"RecordSetMeadowEntity": "Author",
				"RowClickOpensRecord": true,
				// Bulk + advanced delete. The List toolbar gets a "Delete records" button (the BulkDelete
				// screen); both the single (Read view) Delete and the bulk screen offer "Reassign & delete",
				// which repoints this author's BookAuthorJoin rows to a replacement author before deleting —
				// the "two Michael Crichton records, one misspelled, merge them" cleanup.
				"RecordSetAllowBulkDelete": true,
				"RecordSetAdvancedDelete": true,
				// Column chooser over auto-generated (schema-derived) columns — no curated set declared.
				"RecordSetListColumnChooser": true,
				// Show-deleted quick-bar toggle (enumerates soft-deleted authors).
				"RecordSetListShowDeletedFilter": true,

				"RecordSetURLPrefix": "/1.0/",

				"RecordSetReadManifestOnly": true,
				"RecordSetReadManifestsView": [ "Author-View" ],

				// The OTHER side of the same Book<->Author join — opted in independently here, so the
				// Author read view gets a "Books" tab managing the same BookAuthorJoin from its side.
				// Split layout: the author record stays in the left pane beside the "Books" association.
				"ReadLayout": "Split",
				"RecordSetReadSplitLeftWidth": "40%",
				"RecordSetReadTabTitle": "Author",
				"RecordSetReadTabs":
				[
					{
						"Type": "Association",
						"Association": "BookAuthor",
						"Title": "Books"
					}
				],

				"SearchFields": [ "Name" ]
			},
			{
				"RecordSet": "BookStore",
				"Title": "Book Stores",

				"RecordSetType": "MeadowEndpoint",
				"RecordSetMeadowEntity": "BookStore",
				"RowClickOpensRecord": true,

				"RecordSetURLPrefix": "/1.0/",

				// Split read view: the store record stays in the left pane beside the "Catalog"
				// association tab (the books THIS store carries). Plus the bulk-association opt-in that
				// surfaces the "Assign Books to Store" screen.
				"ReadLayout": "Split",
				"RecordSetReadSplitLeftWidth": "40%",
				"RecordSetReadTabTitle": "Store",
				"RecordSetReadTabs":
				[
					{
						"Type": "Association",
						"Association": "BookStoreCatalog",
						"Title": "Catalog",
						// Multi-select add: tick several books as chips, then one "Add selected" links them
						// all. (The Book/Author tabs use the default single-pick + Add.) PickerMode is the
						// light config knob that decides the add control.
						"PickerMode": "multi"
					}
				],
				"RecordSetBulkAssociations":
				[
					{
						"Association": "BookStoreCatalog",
						"Title": "Assign Books to Store"
					}
				],

				"RecordSetListColumns": [
					{
						"Key": "Name",
						"DisplayName": "Store Name"
					},
					{
						"Key": "Address",
						"DisplayName": "Address"
					},
					{
						"Key": "City",
						"DisplayName": "City"
					},
					{
						"Key": "State",
						"DisplayName": "State"
					}
				],

				"SearchFields": [ "Name", "City" ]
			}
		],

		"FilterCriteria":
		{
			"FilterRecordsetByAuthor":
			[
				{
					"FilterDefinitionHash": "ExternalJoinBookByAuthor",
					"FilterByColumn": "IDBook"
				},
				{
					"Type": "StringMatch",
					"FilterByColumn": "Title"
				},
				{
					"Type": "StringMatch",
					"FilterByColumn": "Genre"
				}
			],
			// The "Advanced Search" experience packs nine filter clauses onto a
			// single dashboard render so the parallel filter fan-out added in
			// Pict-Template-FilterInstanceViews is observable in practice. It
			// also exercises a mix of filter types (ExternalJoinSelectedValueList,
			// DistinctSelectedValueList, StringMatch, NumericRange, DateRange) so
			// each filter family is touched at least once in the render path.
			"FilterRecordsetAdvancedSearch":
			[
				{
					"FilterDefinitionHash": "ExternalJoinBookBySelectedAuthors",
					"FilterByColumn": "IDBook"
				},
				{
					"Type": "StringMatch",
					"FilterByColumn": "Title",
					"Label": "Title"
				},
				{
					"Type": "DistinctSelectedValueList",
					"FilterByColumn": "Genre",
					"Label": "Genre"
				},
				{
					"Type": "StringMatch",
					"FilterByColumn": "Type",
					"Label": "Book Type"
				},
				{
					"Type": "StringMatch",
					"FilterByColumn": "Language",
					"Label": "Language"
				},
				{
					"Type": "StringMatch",
					"FilterByColumn": "ISBN",
					"Label": "ISBN"
				},
				{
					"Type": "NumericRange",
					"FilterByColumn": "PublicationYear",
					"Label": "Publication Year"
				},
				{
					"Type": "DateRange",
					"FilterByColumn": "CreateDate",
					"Label": "Added to Catalog"
				},
				{
					"Type": "DateRange",
					"FilterByColumn": "UpdateDate",
					"Label": "Last Updated"
				}
			]
		}
	});
