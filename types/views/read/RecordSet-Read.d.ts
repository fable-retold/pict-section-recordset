export = viewRecordSetRead;
declare class viewRecordSetRead extends libPictRecordSetRecordView {
    layoutType: string;
    action: string;
    tabs: any[];
    RecordSet: any;
    providerHash: any;
    activeTab: any;
    mouseHandler: (event: any) => void;
    manifest: any;
    defaultManifest: {
        Form: string;
        Scope: string;
        Descriptors: {};
        Sections: {
            Name: string;
            Hash: string;
            Solvers: any[];
            ShowTitle: boolean;
            Groups: {
                Name: string;
                Hash: string;
                Rows: any[];
                RecordSetSolvers: any[];
                ShowTitle: boolean;
            }[];
        }[];
    };
    GUID: any;
    initializeDragListener(): void;
    onAfterRender(pRenderable: any): boolean;
    handleRecordSetReadRoute(pRoutePayload: any): Promise<boolean>;
    viewingDeletedRecord: boolean;
    /**
     * The deleted-record read route (`/PSRS/:RecordSet/ViewDeleted/:GUIDRecord`): identical to the
     * View route except the record lookup explicitly includes soft-deleted rows (a normal View of a
     * deleted record finds nothing — delete tracking filters it out — and renders broken). The flag
     * also rides the read data as ViewingDeletedRecord, which drives the deleted banner.
     */
    handleRecordSetReadDeletedRoute(pRoutePayload: any): Promise<boolean>;
    handleRecordSetEditRoute(pRoutePayload: any): Promise<boolean>;
    cancel(): Promise<void>;
    save(): Promise<void>;
    edit(): Promise<void>;
    /**
     * Build the record audit header state — the first-class activity line plus the data the
     * Details modal renders. Identity (ID/GUID) and the create/update/delete stamps are read
     * straight off the fetched record; the acting-user names resolve lazily via {~E:User^…~}
     * in the templates (cachetrax-cached), so nothing is pre-resolved here. Stored at
     * AppData.PRSP_RecordAudit for the templates to consume.
     *
     * @param {Record<string, any>} pRecord - The fetched record.
     */
    _prepareRecordAuditState(pRecord: Record<string, any>): void;
    /**
     * Compute a human-friendly display name for a record using an opinionated heuristic: first +
     * last name, then a single descriptive field (FullName, Name, Title, …), else ''. Callers fall
     * back to the GUID. Lets the page title read "Krishna Pavia Tester" instead of a raw GUID.
     * @param {Record<string, any>} pRecord
     * @return {string}
     */
    _computeDisplayName(pRecord: Record<string, any>): string;
    /**
     * Whether an audit date value is present and meaningful (guards null/empty and the Meadow
     * "0000-00-00" zero-date sentinel).
     * @param {any} pValue
     * @return {boolean}
     */
    _validAuditDate(pValue: any): boolean;
    /**
     * Toggle the anchored identity + audit popover open or closed. The content is rendered inline
     * with the record (so the {~E:User^…~} names resolve during the read render); this just flips
     * its visibility — no overlay.
     */
    toggleRecordAudit(): void;
    /**
     * Bind the one-time document handlers that dismiss the audit popover on an outside click or
     * Escape. Browser-level events with no inline-handler equivalent — bound once and guarded so
     * re-renders don't stack listeners.
     */
    _bindAuditDismiss(): void;
    _auditDismissBound: boolean;
    /**
     * Copy a record value (ID or GUID) to the clipboard from the audit popover, with a toast.
     * @param {string} pValue
     */
    copyValue(pValue: string): void;
    /**
     * Remove identity + audit descriptors from a (cloned) manifest so they don't render inline
     * in the record body — they live behind the audit header's Details modal instead. Also
     * prunes any section left with no descriptors (e.g. an emptied "Audit Trail" section). The
     * entity's own ID/GUID field names are suppressed alongside the shared audit fields.
     * @param {Record<string, any>} pManifest - The cloned manifest to mutate.
     */
    _suppressAuditDescriptors(pManifest: Record<string, any>): void;
    onBeforeRenderRead(pRecordReadData: any): any;
    formatDisplayData(pRecordListData: any): any;
    onBeforeEdit(): Promise<void>;
    onBeforeSave(): Promise<void>;
    onBeforeView(): Promise<void>;
    onBeforeTabChange(): Promise<void>;
    renderRead(pRecordConfiguration: any, pProviderHash: any, pRecordGUID: any): Promise<boolean>;
    setTab(t: any): Promise<void>;
    _buildDefaultManifest(recordSet: any): Promise<{
        Form: string;
        Scope: string;
        Descriptors: {};
        Sections: {
            Name: string;
            Hash: string;
            Solvers: any[];
            ShowTitle: boolean;
            Groups: {
                Name: string;
                Hash: string;
                Rows: any[];
                RecordSetSolvers: any[];
                ShowTitle: boolean;
            }[];
        }[];
    }>;
    _generateManifestTemplate(config: any, section: any, specificManifest: any, setBaseManifest: any, action: string, defaultManifest: any): string;
    _structureTabs(config: any, record: any): Promise<{
        Type: string;
        RecordSet: any;
        Title: any;
        Hash: string;
        Template: string;
        TabTemplate: string;
        render: () => void;
    }[]>;
}
declare namespace viewRecordSetRead {
    export { _DEFAULT_CONFIGURATION__Read as default_configuration };
}
import libPictRecordSetRecordView = require("../RecordSet-RecordBaseView.js");
/** @type {Record<string, any>} */
declare const _DEFAULT_CONFIGURATION__Read: Record<string, any>;
//# sourceMappingURL=RecordSet-Read.d.ts.map