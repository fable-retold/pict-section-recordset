export = viewPictSectionRecordSetViewBase;
declare class viewPictSectionRecordSetViewBase extends libPictView {
    constructor(pFable: any, pOptions: any, pServiceHash: any);
    /** @type {import('pict') & {
     *   log: any,
     *   instantiateServiceProviderWithoutRegistration: (hash: String) => any,
     *   instantiateServiceProviderIfNotExists: (hash: string) => any,
     *   TransactionTracking: import('pict/types/source/services/Fable-Service-TransactionTracking'),
     *   PictSectionRecordSet: InstanceType<import('../Pict-Section-RecordSet.js')>,
     * }} */
    pict: import("pict") & {
        log: any;
        instantiateServiceProviderWithoutRegistration: (hash: string) => any;
        instantiateServiceProviderIfNotExists: (hash: string) => any;
        TransactionTracking: import("pict/types/source/services/Fable-Service-TransactionTracking");
        PictSectionRecordSet: InstanceType<{
            new (pFable: any, pOptions: any, pServiceHash: any): import("../services/RecordsSet-MetaController.js");
            default_configuration: Record<string, any>;
            isFableService: boolean;
            CoreServiceProviderBase: typeof import("fable-serviceproviderbase");
            PictRecordSetApplication: typeof import("../application/Pict-Application-RecordSet.js");
            RecordSetProviderBase: typeof import("../providers/RecordSet-RecordProvider-Base.js");
            RecordSetProviderMeadowEndpoints: typeof import("../providers/RecordSet-RecordProvider-MeadowEndpoints.js");
            ColumnDataProvider: typeof import("../providers/Column-Data-Provider.js");
        }>;
    };
    addRoutes(pPictRouter: any): boolean;
}
declare namespace viewPictSectionRecordSetViewBase {
    export { _DEFAULT_CONFIGURATION_Base_View as default_configuration };
}
import libPictView = require("pict-view");
/** @type {Record<string, any>} */
declare const _DEFAULT_CONFIGURATION_Base_View: Record<string, any>;
//# sourceMappingURL=RecordSet-RecordBaseView.d.ts.map