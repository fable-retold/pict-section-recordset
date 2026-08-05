// The container for all the Pict-Section-Form related code.

// The main dynamic view class
module.exports = require('./services/RecordsSet-MetaController.js');
//module.exports.default_configuration = require('./views/Pict-View-DynamicForm-DefaultConfiguration.json');

// The application container
module.exports.PictRecordSetApplication = require('./application/Pict-Application-RecordSet.js');

// Export the providers
module.exports.RecordSetProviderBase = require('./providers/RecordSet-RecordProvider-Base.js');
module.exports.RecordSetProviderMeadowEndpoints = require('./providers/RecordSet-RecordProvider-MeadowEndpoints.js');
module.exports.ColumnDataProvider = require('./providers/Column-Data-Provider.js');
module.exports.AssociationManager = require('./providers/RecordSet-AssociationManager.js');
module.exports.DependentManager = require('./providers/RecordSet-DependentManager.js');
module.exports.CardManager = require('./providers/RecordSet-CardManager.js');

// Joined-entity association views (embeddable read-tab editor + bulk associate screen)
module.exports.AssociationEditorView = require('./views/associate/RecordSet-AssociationEditor.js');
module.exports.AssociateBulkView = require('./views/associate/RecordSet-AssociateBulk.js');
module.exports.AssociateMatrixView = require('./views/associate/RecordSet-AssociateMatrix.js');
module.exports.AssociateUnlinkView = require('./views/associate/RecordSet-AssociateUnlink.js');

// Bulk delete screen (batch delete, with optional advanced reassociation of relationships)
module.exports.BulkDeleteView = require('./views/delete/RecordSet-BulkDelete.js');
