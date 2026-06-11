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
