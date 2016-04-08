$.sap.declare("kanban5.utils.clone");

kanban5.utils.clone = function(obj) {
 		// JSON.parse(JSON.stringify(o));
 		return $.extend(true, {}, obj);
};