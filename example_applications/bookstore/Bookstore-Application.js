const libPictRecordSet = require('../../source/Pict-Section-RecordSet.js');
// pict-section-picker (sibling module, by relative path for the example) + its pict-section-form
// 'Picker' InputType adapter — demonstrates the entity filters rendering a picker instead of the
// built-in table UI.
const libPictSectionPicker = require('../../../pict-section-picker');
const libPictPickerForm = require('../../../pict-section-picker/form');
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

		"DefaultRecordSetConfigurations":
		[
			{
				"RecordSet": "Book",

				"RecordSetType": "MeadowEndpoint",
				"RecordSetMeadowEntity": "Book",

				"RecordSetIgnoreFilterFields": [ "Deleted", "DeletingIDUser", "DeleteDate", "UpdateDate" ],

				// Quick Filters — a curated, one-click bar above the full "Add filter" list. (Without this
				// the bar is clever-derived from the schema.) Showcases all three control types: text
				// (Title/Genre), date range (CreateDate), and entity picker (CreatingIDUser → User).
				"QuickFilters": [ "Title", "Genre", { "Field": "CreateDate", "Label": "Added" }, { "Field": "CreatingIDUser", "Label": "Added by" } ],

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

				"RecordSetReadTabs":
				[
					{
						"Type": "AttachedRecord",
						"RecordSet": "Author",
						"Title": "Authors",
						"JoiningRecordSet": "BookAuthorJoin"
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
				// Column chooser over auto-generated (schema-derived) columns — no curated set declared.
				"RecordSetListColumnChooser": true,
				// Show-deleted quick-bar toggle (enumerates soft-deleted authors).
				"RecordSetListShowDeletedFilter": true,

				"RecordSetURLPrefix": "/1.0/",

				"RecordSetReadManifestOnly": true,
				"RecordSetReadManifestsView": [ "Author-View" ],

				"SearchFields": [ "Name" ]
			},
			{
				"RecordSet": "BookStore",
				"Title": "Book Stores",

				"RecordSetType": "MeadowEndpoint",
				"RecordSetMeadowEntity": "BookStore",
				"RowClickOpensRecord": true,

				"RecordSetURLPrefix": "/1.0/",

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
			// StringMatch, NumericRange, DateRange) so each filter family is
			// touched at least once in the render path.
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
					"Type": "StringMatch",
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
