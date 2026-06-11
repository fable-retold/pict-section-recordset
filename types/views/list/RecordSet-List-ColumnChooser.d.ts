export = viewRecordSetListColumnChooser;
declare class viewRecordSetListColumnChooser extends libPictView {
    constructor(pFable: any, pOptions: any, pServiceHash: any);
    _chooserRecordSet: string;
    _chooserSearch: string;
    /**
     * Open/close the chooser popover (the trigger button's handler).
     *
     * Open/closed is derived from the popover's DOM class, not an instance flag — a full list
     * re-render replaces the popover element (visually closed), so a flag would go stale and
     * demand a double-click to reopen.
     *
     * @param {Event} pEvent - The DOM click event
     * @param {string} pRecordSet - The record set whose columns to manage
     */
    toggleColumnChooser(pEvent: Event, pRecordSet: string): void;
    /** Close the chooser popover. */
    closeColumnChooser(): void;
    /**
     * Filter the chooser's column list by a search term, re-rendering only the list so the
     * search input keeps focus.
     * @param {string} pValue - The search term.
     */
    searchColumnChooser(pValue: string): void;
    /**
     * Flip a column's visibility (a chooser row's handler). Delegates to the list view — which
     * persists the override and repaints the rows body-only — then repaints the chooser rows
     * truthfully (the list view may have refused, e.g. hiding the last visible column).
     * @param {string} pKey - The column key to toggle.
     */
    toggleColumn(pKey: string): void;
    /** Clear all overrides for the record set and repaint with default visibility (footer button). */
    resetColumns(): void;
    /**
     * (Re)build the chooser's row models into AppData from the list view's pristine column
     * candidates (single source of truth) + the current overrides, honouring the search term.
     */
    _buildColumnChooserRows(): void;
    /**
     * Reflect the popover's open/closed state on its container element.
     * @param {boolean} pOpen - Whether the popover should be open.
     */
    _paintColumnChooserOpenState(pOpen: boolean): void;
    /**
     * Position the (fixed) popover against the trigger button, flipping above when there's more
     * room there — same approach as the filters view's add-filter popover, so no ancestor
     * overflow:hidden can clip it.
     *
     * @param {HTMLElement} pPopover - the #PRSP_ColumnChooser_Popover element (already display:block).
     */
    _positionColumnChooserPopover(pPopover: HTMLElement): void;
}
declare namespace viewRecordSetListColumnChooser {
    export { _DEFAULT_CONFIGURATION_List_ColumnChooser as default_configuration };
}
import libPictView = require("pict-view");
/**
 * The list's column chooser: a small right-aligned "Columns" button above the table that opens a
 * popover of checkbox rows — the host-curated columns first, then the entity's remaining scalar
 * schema columns — letting the user show/hide columns per record set. Choices persist through the
 * ColumnDataProvider and repaint body-only through the list view (the filter bar is never touched).
 *
 * Renders nothing unless the active record set's configuration sets RecordSetListColumnChooser: true
 * (the list view only populates Record.ColumnChooserSlot when the flag is on).
 */
/** @type {Record<string, any>} */
declare const _DEFAULT_CONFIGURATION_List_ColumnChooser: Record<string, any>;
//# sourceMappingURL=RecordSet-List-ColumnChooser.d.ts.map