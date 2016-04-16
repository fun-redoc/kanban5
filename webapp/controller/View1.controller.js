$.sap.require("sap.ui.thirdparty.jqueryui.jquery-ui-core");
$.sap.require("sap.ui.thirdparty.jqueryui.jquery-ui-widget");
$.sap.require("sap.ui.thirdparty.jqueryui.jquery-ui-mouse");
$.sap.require("sap.ui.thirdparty.jqueryui.jquery-ui-sortable");
$.sap.require("sap.ui.thirdparty.jqueryui.jquery-ui-droppable");
$.sap.require("sap.ui.thirdparty.jqueryui.jquery-ui-draggable");
//$.sap.require("kanban5.utils.clone");

sap.ui.define(["sap/ui/core/mvc/Controller", "kanban5/utils/clone"], function(Controller, clone) {
	"use strict";
	return Controller.extend("kanban5.controller.View1", {

		onInit: function() {
			var newList = this.getView().byId("__listNew");
			var inWorkList = this.getView().byId("__listInWork");
			var completedList = this.getView().byId("__listCompleted");

			// look at http://api.jqueryui.com/sortable/
			inWorkList.onAfterRendering = this.dropItem.bind(inWorkList, this);
			newList.onAfterRendering = this.dropItem.bind(newList, this);
			completedList.onAfterRendering = this.dropItem.bind(completedList, this);
		},
		
		onAssign: function(evt) {
			this._showTaskPopOverAndReturnPremise(evt.getSource().getBindingContext(), evt.getSource(), "{i18n>assignTask}", "Assignee")
				.then($.proxy(function(context) {
					var model = context.getModel();
					console.log("assign", context.getObject());
					if (model.hasPendingChanges()) {
						console.log("there are pending changes");
						model.submitChanges({
							success: function() {
								console.log("success submitting changes", arguments);
								model.refresh(true);
							},
							error: function() {
								console.log("failed subbmitting changes", arguments);
							}
						});
					}
				}, this))
				.fail($.proxy(function(context) {
					console.log("dont assign");
				}, this));
			
		},

		dropItem: function(controller) {
			// TODO handle drop on a different lane (UL Element)
			// check if binding changes from srtrt of drag to stop
			var listId = this.getId();
			// alternativelly var inWorkListId = this.createId("__listInWork")
			var listUlId = listId + "-listUl";

			if (sap.m.List.prototype.onAfterRendering) {
				sap.m.List.prototype.onAfterRendering.apply(this);
			}
			$("#" + listUlId).addClass("ui-sortable");
			$("#" + listUlId).sortable({
				connectWith: ".ui-sortable",
				stop: function(evnt, ui) {
					var dropListId = ui.item.parent()[0].id;
					if (listUlId !== dropListId) {
						$("#" + listUlId).sortable("cancel");
						return;
					}
					var droppedId = ui.item[0].id;
					var droppedItem = sap.ui.getCore().byId(droppedId);
					var droppedObject = droppedItem.getBindingContext().getObject();
					console.log("dropped", droppedObject);

					var prevPrio = 0.0;
					var savedPrevPrioInCaseOfReplacingLastItem = 0.0;
					var prevUl = ui.item.prev();
					if (prevUl.length > 0) {
						var prevId = prevUl[0].id;
						var prevItem = sap.ui.getCore().byId(prevId);
						var prevObject = prevItem.getBindingContext().getObject();
						savedPrevPrioInCaseOfReplacingLastItem = prevObject.Priority;
						prevPrio = prevObject.Priority;
						console.log("prev", prevObject);
					}

					var nextPrio = savedPrevPrioInCaseOfReplacingLastItem + 1.0;
					var nextUl = ui.item.next();
					if (nextUl.length > 0) {
						var nextId = nextUl[0].id; //ui.item.next()[0].id;
						var nextItem = sap.ui.getCore().byId(nextId);
						var nextObject = nextItem.getBindingContext().getObject();
						nextPrio = nextObject.Priority;
						console.log("next", nextObject);
					} else {
						console.log("no next item");
					}

					var droppedPrio = 0.5 * (prevPrio + nextPrio);
					console.log("droppedPrio", droppedPrio);
					droppedObject.Priority = droppedPrio;

					var sPath = droppedItem.getBindingContext().getPath();
					var model = droppedItem.getBindingContext().getModel();
					var obj = clone(droppedObject);
					obj.Priority = droppedPrio;
					model.update(sPath,
						obj, {
							success: function(oData, response) {
								model.refresh(true);
								this.updateItems();
							}.bind(this),
							error: function(oError) {
								console.log("error", oError);
								// TODO show errors to user
							}
						});
				}.bind(this)
			}).disableSelection();
		},

		onAddItem: function(evt) {
			var source = evt.getSource();
			var bindingContext = source.getBindingContext();
			var model = this.getView().getModel();
			var newContextObject = model.createEntry("/Tasks", {
				properties: {
					Name: "Hallo",
					Status: "New",
					EntryDate: new Date(),
					DueDate: null,
					Description: null,
					IsAssigned: false,
					Assignee: null,
					Priority: (this._maxPriority() + 1)
				},
				success: function(oData) {
					console.log("successfully created entry", arguments);
					model.refresh(true);
				},
				error: function(oError) {
					console.log("error while creating object", arguments);
					// TODO show errors to user
				}
			});
			this._showTaskPopOverAndReturnPremise(newContextObject, source, "{i18n>newTask}")
				.then($.proxy(function(context) {
					console.log("add", context.getObject());
					if (model.hasPendingChanges()) {
						console.log("there are pending changes");
						model.submitChanges({
							success: function() {
								console.log("success submitting changes", arguments);
							},
							error: function() {
								console.log("failed subbmitting changes", arguments);
							}
						});
					}
				}, this))
				.fail($.proxy(function(context) {
					console.log("dont add");
					model.deleteCreatedEntry(context);
				}, this));
		},
		onMoveToNew: function(evt) {
			this._moveItemToStatus("New", evt);
		},
		onMoveToCompleted: function(evt) {
			this._moveItemToStatus("Completed", evt);
		},
		onMoveToInWork: function(evt) {
			this._moveItemToStatus("InWork", evt);
		},
		onItemDelete: function(evt) {
			var bindingContext = evt.getSource().getBindingContext();
			var sPath = bindingContext.getPath();
			var model = this.getView().getModel();
			model.remove(sPath, {
				success: function(oData, response) {
					model.refresh(true);
				}.bind(this),
				error: function(oError) {
					console.log("error", oError);
					// TODO show errors to user
				}
			});
		},

		onDetailPress: function(evt) {
			console.log("onDetailPress", evt);
		},

		_minPriority: function() {
			var items = this.getView().getModel().getProperty("/");
			var keys = Object.keys(items);
			return keys.reduce(function(accu, key) {
					return accu > items[key].Priority ? items[key].Priority : accu;
				},
				Number.MAX_VALUE);
		},

		_maxPriority: function() {
			var items = this.getView().getModel().getProperty("/");
			var keys = Object.keys(items);
			return keys.reduce(function(accu, key) {
					return accu < items[key].Priority ? items[key].Priority : accu;
				},
				Number.MIN_VALUE);
		},
		_moveItemToStatus: function(newStatus, evt) {
			var bindingContext = evt.getSource().getParent().getParent().getBindingContext();
			var sPath = bindingContext.getPath();
			var obj = bindingContext.getObject();
			var model = this.getView().getModel();
			var oldStatus = obj.Status;
			obj.Status = newStatus;
			// adjust priotity:
			// New->InWork: end of the list (least priority)
			// InWork->Completed: beginning of the list (highest priority)
			// Completed->InWOrk: beginning of the list
			// inWork->New: beginning of the list
			if(oldStatus === "New" && newStatus === "InWork") {
				obj.Priority = this._minPriority()/2.0;
			} else if(oldStatus === "InWork" && newStatus === "Completed") {
				obj.Priority = this._maxPriority() + 1.0;
			} else if(oldStatus === "Completed" && newStatus === "InWork") {
				obj.Priority = this._maxPriority() + 1.0;
			} else if(oldStatus === "InWork" && newStatus === "New") {
				obj.Priority = this._maxPriority() + 1.0;
			} else {
				throw new Error("Programing Error");
			}
			model.update(sPath,
				obj, {
					success: function(oData, response) {
						model.refresh(true);
					}.bind(this),
					error: function(oError) {
						console.log("error", oError);
						// TODO show errors to user
					}
				});
		},
		_createForm: function(context, oController, title) {
			var form = new sap.ui.layout.form.SimpleForm(
				this.createId("form"), {
					//minWidth="1024"
					maxContainerCols: 2,
					editable: true,
					layout: "ResponsiveGridLayout",
					title: title,
					labelSpanL: 3,
					labelSpanM: 3,
					emptySpanL: 4,
					emptySpanM: 4,
					columnsL: 1,
					columnsM: 1,
					class: "editableForm"
				});
			form
				.addContent(new sap.m.Label({
					text: "{i18n>taskName}"
				}))
				.addContent(new sap.m.Input(this.createId("Name"), {
					value: "{Name}"
				}))
				.addContent(new sap.m.Label({
					text: "{i18n>EntryDate}"
				}))
				.addContent(new sap.m.DatePicker(this.createId("EntryDate"), {
					placeholder: "{i18n>EntryDate...}",
					//dateValue:"{ path:"EntryDate", type:"sap.ui.model.odata.type.DateTime", formatOptions: { style: "medium", strictParsing: true} }"
					dateValue: "{EntryDate}"
				}))
				.addContent(new sap.m.Label({
					text: "{i18n>DueDate}"
				}))
				.addContent(new sap.m.DatePicker(this.createId("DueDate"), {
					placeholder: "{i18n>DueDate...}",
					value: "{ path:'DueDate', type:'sap.ui.model.odata.type.DateTime', formatOptions: { style: 'medium', strictParsing: true} }"
				}))
				.addContent(new sap.m.Label({
					text: "{i18n>assignTO}"
				}))
				.addContent(new sap.m.Input(this.createId("Assignee"), {
					value: "{Assignee}"
				}))
				.addContent(new sap.m.Label({
					text: "{i18n>Descritption}"
				}))
				.addContent(new sap.m.TextArea(this.createId("Description"), {
					value: "{Description}"
				}));

			form.setBindingContext(context);
			return form;
		},
		_showTaskPopOverAndReturnPremise: function(context, openByControl, title, scrollToProperty) {
			var deferred = $.Deferred();
			var popOver = new sap.m.ResponsivePopover({
				"class": "sapUiPopupWithPadding",
				placement: "Bottom",
				title: title
			});
			popOver
				.setBindingContext(context)
				.setBeginButton(new sap.m.Button({
					text: "{i18n>Cancel}",
					press: function() {
						deferred.reject(context);
						popOver.close();
					}
				}))
				.setEndButton(new sap.m.Button({
					text: "{i18n>Save}",
					press: function(evt) {
						if (sap.ui.model.BindingMode.TwoWay !== context.getModel().getDefaultBindingMode()) {
							$.sap.log.trace("Binding Mode is not TwoWay, you ave to manually transfer data");
							var model = popOver.getBindingContext().getModel();
							var sPath = popOver.getBindingContext().getPath();
							var setProperty = function(property, value) {
								model.setProperty(sPath.concat("/").concat(property), value);
							};
							console.log("Assigniee", this.byId("Assignee").getValue());
							setProperty("Name", this.byId("Name").getValue());
							setProperty("EntryDate", this.byId("EntryDate").getDateValue());
							setProperty("DueDate", this.byId("DueDate").getDateValue());
							setProperty("Description", this.byId("Description").getValue());
							var assignee = this.byId("Assignee").getValue();
							if( assignee ) {
								setProperty("IsAssigned", true);
								setProperty("Assignee", assignee);
							} else {
								setProperty("IsAssigned", false);
								setProperty("Assignee", null);
							}
						} else {
							if (popOver.getBindingContext().getObject().Assignee !== null) {
								popOver.getBindingContext().getObject().IsAssigned = true;
							}
						}
						deferred.resolve(popOver.getBindingContext());
						popOver.close();
					}.bind(this)
				}))
				.addContent(this._createForm(context, this, title));

			// when close revome from dom
			popOver.attachAfterClose(null, function() {
				this.getView().removeDependent(popOver);
				popOver.destroy();
			}, this);
			
			popOver.attachAfterOpen(null, function() {
				if( scrollToProperty ) {
					this.byId(scrollToProperty).focus();
				}
			}, this);
			
			this.getView().addDependent(popOver);
			popOver.openBy(openByControl);

			return deferred.promise();
		}
	});
});