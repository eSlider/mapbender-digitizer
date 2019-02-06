

(function ($) {
    "use strict";


    /**
     * Escape HTML chars
     * @returns {string}
     */
    String.prototype.escapeHtml = function () {

        return this.replace(/[\"&'\/<>]/g, function (a) {
            return {
                '"': '&quot;',
                '&': '&amp;',
                "'": '&#39;',
                '/': '&#47;',
                '<': '&lt;',
                '>': '&gt;'
            }[a];
        });
    };

    /**
     * Translate digitizer keywords
     * @param title
     * @param withoutSuffix
     * @returns {*}
     */





    /**
     * Digitizing tool set
     *
     * @author Andriy Oblivantsev <eslider@gmail.com>
     * @author Stefan Winkelmann <stefan.winkelmann@wheregroup.com>
     *
     * @copyright 20.04.2015 by WhereGroup GmbH & Co. KG
     */
    $.widget("mapbender.mbDigitizer", {
        toolsets: {
            point: [ {type: 'drawPoint'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}],
            line: [ {type: 'drawLine'}, {type: 'modifyFeature'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'} ],
            polygon: [{type: 'drawPolygon'}, {type: 'drawRectangle'}, {type: 'drawCircle'}, {type: 'drawEllipse'}, {type: 'drawDonut'}, {type: 'modifyFeature'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'} ]
        },
        /**
         * @type {OpenLayers.Map}
         */
        map: null,
        currentSchema: null,
        featureEditDialogWidth: "423px",
        //unsavedFeatures: {},

        /**
         * Default styles merged by schema styles if defined
         */
        styles: {
            'default': {
                strokeWidth: 1,
                strokeColor: '#6fb536',
                fillColor: "#6fb536",
                fillOpacity: 0.3
                //, label: '${label}'
            },
            'select': {
                strokeWidth: 3,
                fillColor: "#F7F79A",
                strokeColor: '#6fb536',
                fillOpacity: 0.5,
                graphicZIndex: 15
            },
            'selected': {
                strokeWidth: 3,
                fillColor: "#74b1f7",
                strokeColor: '#b5ac14',
                fillOpacity: 0.7,
                graphicZIndex: 15
            },
            'copy': {
                strokeWidth: 5,
                fillColor: "#f7ef7e",
                strokeColor: '#4250b5',
                fillOpacity: 0.7,
                graphicZIndex: 15
            }

        },
        /**
         * Constructor.
         *
         * At this moment not all elements (like a OpenLayers) are avaible.
         *
         * @private
         */
        _create: function () {

            var widget = this.widget = this;
            var element = widget.element;

            if (!Mapbender.checkTarget("mbDigitizer", widget.options.target)) {
                return;
            }

            widget.elementUrl = Mapbender.configuration.application.urls.element + '/' + element.attr('id') + '/';
            Mapbender.elementRegistry.onElementReady(widget.options.target, $.proxy(widget._setup, widget));

        },


        /**
         *
         * @param styleData
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
         * @private
         */
        _applyStyle: function (styleData, olFeature) {
            var style = new OpenLayers.Style(styleData);
            var styleMap = olFeature.layer.options.styleMap;
            var styleId = styleData.id || Mapbender.Util.UUID();
            var oldStyleId = olFeature.styleId || null;
            styleMap.styles[styleId] = style;
            olFeature.styleId = styleId;
            olFeature.layer.drawFeature(olFeature, styleId);
            if (oldStyleId && oldStyleId != styleId) {
                delete styleMap.styles[oldStyleId];
            }
        },
        /**
         *
         * @param schemaName
         * @param styleData
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
         * @returns {*|xhr}
         * @private
         */

        _saveStyle: function (schemaName, styleData, olFeature) {
            return this.query('style/save', {
                style: styleData,
                featureId: olFeature.fid,
                schema: schemaName
            });
        },


        _createMapContextMenu: function () {
            var widget = this;
            var map = widget.map;


            var options = {
                selector: 'div',
                events: {
                    show: function (options) {
                        var schema = widget.currentSchema;
                        return schema.useContextMenu;
                    }
                },
                build: function (trigger, e) {
                    var items = {};
                    var schema = widget.currentSchema;
                    var feature = schema.layer.getFeatureFromEvent(e);
                    var features;

                    if (!feature) {
                        items['no-items'] = {name: "Nothing selected!"}
                    } else {

                        if (feature._sketch) {
                            return items;
                        }

                        features = feature.cluster || [feature];

                        _.each(features, function (feature) {
                            items[feature.fid] = schema.createContextMenuSubMenu(feature);
                        });
                    }

                    return {
                        items: items,
                        callback: function (key, options) {
                            var selectedElement = options.$selected;
                            if (!selectedElement) {
                                return
                            }
                            var parameters = options.items[selectedElement.parent().closest('.context-menu-item').data('contextMenuKey')];

                            if (!parameters) {
                                return;
                            }

                            if (parameters.items[key].action) {
                                parameters.items[key].action(key, options, parameters);
                            }
                        }
                    };
                }
            };

            $(map.div).contextMenu(options);

        },

        _createElementContextMenu: function () {
            var widget = this;
            var element = $(widget.element);

            $(element).contextMenu({
                selector: '.mapbender-element-result-table > div > table > tbody > tr',
                events: {
                    show: function (options) {
                        var tr = $(options.$trigger);
                        var resultTable = tr.closest('.mapbender-element-result-table');
                        var api = resultTable.resultTable('getApi');
                        var olFeature = api.row(tr).data();

                        if (!olFeature) {
                            return false;
                        }

                        var schema = widget.findFeatureSchema(olFeature);
                        return schema.useContextMenu;
                    }
                },
                build: function ($trigger, e) {

                    var tr = $($trigger);
                    var resultTable = tr.closest('.mapbender-element-result-table');
                    var api = resultTable.resultTable('getApi');
                    var olFeature = api.row(tr).data();

                    if (!olFeature) {
                        return {
                            callback: function (key, options) {
                            }
                        };
                    }

                    var schema = widget.findFeatureSchema(olFeature);
                    var items = {};

                    items['changeStyle'] = {name: Mapbender.DigitizerTranslator.translate('feature.style.change')};
                    items['zoom'] = {name: Mapbender.DigitizerTranslator.translate('feature.zoomTo')};
                    if (schema.allowDelete) {
                        items['removeFeature'] = {name: Mapbender.DigitizerTranslator.translate('feature.remove.title')};
                    }

                    if (schema.allowEditData) {
                        items['edit'] = {name: Mapbender.DigitizerTranslator.translate('feature.edit')};
                    }

                    return {
                        callback: function (key, options) {
                            switch (key) {
                                case 'removeFeature':
                                    schema.removeFeature(olFeature);
                                    break;

                                case 'zoom':
                                    schema.zoomToJsonFeature(olFeature);
                                    break;

                                case 'edit':
                                    schema._openFeatureEditDialog(olFeature);
                                    break;

                                case 'exportGeoJson':
                                    widget.exportGeoJson(olFeature);
                                    break;

                                case 'changeStyle':
                                    schema.openChangeStyleDialog(olFeature);
                                    break;
                            }
                        },
                        items: items
                    };
                }
            });

        },


        _getNonBlackListedOptions: function() {
            var widget = this;
            var blacklist = ['schemes', 'target', 'create', 'jsSrc', 'disabled'];
            return _.omit(widget.options, blacklist);
        },

        _createSchemes: function () {
            var widget = this;
            var newSchemes = {};
            _.each(widget.options.schemes, function (rawScheme, schemaName) {
                rawScheme.schemaName = schemaName;
                newSchemes[schemaName] = new Scheme(rawScheme,widget);
            });

            widget.options.schemes =  newSchemes;
        },

        _createOnSelectorChangeCallback: function () {
            var widget = this;
            var selector = widget.selector;

            return function () {
                var option = selector.find(":selected");
                var newSchema = option.data("schemaSettings");

                widget.currentSchema && widget.currentSchema.deactivateSchema();

                newSchema.activateSchema();
                newSchema._getData();
            }

        },

        _initializeSelector: function() {
            var widget = this;
            var options = widget.options;
            var selector = widget.selector;

            if (options.schema) {
                selector.val(options.schema);
            }

            var onSelectorChange = widget._createOnSelectorChangeCallback();
            selector.on('change', onSelectorChange);
            onSelectorChange();

        },

        _initializeMapEvents: function() {
            var widget = this;
            var map = widget.map;

            map.events.register("moveend", this, function () {
                widget.currentSchema._getData();
            });
            map.events.register("zoomend", this, function (e) {
                widget.currentSchema._getData();
                widget.updateClusterStrategies();
            });
            map.resetLayersZIndex();
        },

        _initializeSelectorOrTitleElement: function() {
            var widget = this;
            var options = widget.options;
            var element = $(widget.element);
            var titleElement = $("> div.title", element);


            var hasOnlyOneScheme = _.size(options.schemes) === 1;

            if (hasOnlyOneScheme) {
                titleElement.html(_.toArray(options.schemes)[0].label);
                selector.css('display', 'none');
            } else {
                titleElement.css('display', 'none');
            }
        },

        _setup: function () {

            var widget = this;
            var element = $(widget.element);
            var selector = widget.selector = $("select.selector", element);
            var options = widget.options;

            widget.map = $('#' + options.target).data('mapbenderMbMap').map.olMap;

            widget._initializeSelectorOrTitleElement();

            widget._createSchemes();

            widget._createMapContextMenu();

            widget._createElementContextMenu();

            widget._initializeSelector();

            widget._initializeActivationContainer();

            widget._initializeMapEvents();

            widget._trigger('ready');

            widget.updateClusterStrategies();

        },


        // TODO Kanonen->Spatzen: refactoring
        _initializeActivationContainer: function() {
            var widget = this;

            var containerInfo = new MapbenderContainerInfo(widget, {
                onactive: function () {
                    widget.activate();
                },
                oninactive: function () {
                    widget.deactivate();
                }
            });

            return containerInfo;

        },




        /**
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
         * @private
         */
        _processCurrentFormItemsWithDataManager: function (olFeature) {
            var widget = this;
            var schema = widget.currentSchema;

            // dataManager access function
            // TODO: maybe it would be better to create public methods on dataManager to do this
            function withSchema(dataManager, schemaName, callback) {
                var schema = dataManager.options.schemes[schemaName];
                // FIXME: following lines are a hack to get dataManager to open the correct popup
                // (it does open the popup for the scheme provided in currentSettings, not
                // the one passed to the _openEditPopup function)
                var prevSettings = dataManager.currentSettings;
                var prevActiveSchema = dataManager.activeSchema;
                dataManager.activeSchema = dataManager.currentSettings = schema;

                dataManager._getData(schema).then(function () {
                    callback(schema);
                    dataManager.currentSettings = prevSettings;
                    dataManager.activeSchema = prevActiveSchema;
                });
            }

            DataUtil.eachItem(widget.currentSchema.formItems, function (item) {

                if (item.type === "resultTable" && item.editable && !item.isProcessed) {
                    var onCreateClick;
                    var onEditClick;

                    if (!item.hasOwnProperty('dataManagerLink')) {
                        onCreateClick = function (e) {
                            e.preventDefault();
                            var item = $(this).next().data("item");
                            var popup = item.popupItems;
                            var table = $(this).siblings(".mapbender-element-result-table")
                            var uniqueIdKey = item.dataStore.uniqueId;

                            var feature = table.data('olFeature');
                            var data = {};

                            item.allowRemove = false;
                            data['linkId'] = feature.attributes[item.dataStoreLink.uniqueId];
                            data.item = item;
                            data[uniqueIdKey] = null;
                            widget._openEditDialog(data, popup, item, table);
                            return false;
                        };

                        onEditClick = function (rowData, ui, e) {
                            e.defaultPrevented && e.defaultPrevented();
                            e.preventDefault && e.preventDefault();

                            var table = ui.parents('.mapbender-element-result-table');
                            var item = table.data('item');
                            var popup = item.popupItems;
                            var feature = table.data('olFeature');

                            item.allowRemove = true;
                            rowData.externalId = feature.attributes[item.dataStoreLink.uniqueId];

                            widget._openEditDialog(rowData, popup, item, table);

                            return false;
                        };
                    } else if (item.hasOwnProperty('dataManagerLink')) {
                        var schemaName = item.dataManagerLink.schema;
                        var fieldName = item.dataManagerLink.fieldName;
                        var schemaFieldName = item.dataManagerLink.schemaFieldName;

                        onCreateClick = function (e) {
                            e.preventDefault && e.preventDefault();

                            var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];
                            withSchema(dm, schemaName, function (schema) {
                                dm._openEditDialog(schema.create());
                            });

                            return false;
                        };

                        onEditClick = function (rowData, ui, e) {
                            e.defaultPrevented && e.defaultPrevented();
                            e.preventDefault && e.preventDefault();

                            var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];

                            withSchema(dm, schemaName, function (schema) {
                                var dataItem = _.find(schema.dataItems, function (d) {
                                    return d[schemaFieldName] === rowData[fieldName];
                                });
                                dm._openEditDialog(dataItem);
                            });

                            return false;
                        };
                    }

                    var cloneItem = $.extend({}, item);
                    cloneItem.isProcessed = true;
                    item.type = "container";
                    var button = {
                        type: "button",
                        title: "",
                        cssClass: "fa fa-plus",
                        click: onCreateClick
                    };

                    item.children = [button, cloneItem];

                    var buttons = [];

                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                        className: 'edit',
                        onClick: onEditClick
                    });

                    cloneItem.buttons = buttons;

                }

                if (item.type === "select" && !item.isProcessed && ((item.dataStore && item.dataStore.editable && item.dataStore.popupItems) || item.dataManagerLink)) {
                    var onCreateClick;
                    var onEditClick;

                    if (item.dataManagerLink) {
                        var schemaName = item.dataManagerLink.schema;
                        var schemaFieldName = item.dataManagerLink.schemaFieldName;

                        onCreateClick = function (e) {
                            e.preventDefault && e.preventDefault();

                            var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];
                            withSchema(dm, schemaName, function (schema) {
                                dm._openEditDialog(schema.create());

                            });
                            $(dm.element).on('data.manager.item.saved', function (event, eventData) {
                                var uniqueIdKey = eventData.uniqueIdKey;
                                var text = item.itemPattern.replace('{id}', eventData.item[uniqueIdKey]).replace('{name}', eventData.item[item.itemName]);
                                var $option = $('<option />').val(eventData.item[uniqueIdKey]).text(text);
                                var $select = $('select[name=' + item.name + ']').append($option);
                                $select.val(eventData.item[uniqueIdKey]);
                            });
                            return false;
                        };

                        onEditClick = function (e) {
                            e.preventDefault && e.preventDefault();

                            var val = $(this).siblings().find('select').val();
                            var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];
                            withSchema(dm, schemaName, function (schema) {
                                var dataItem = _.find(schema.dataItems, function (d) {
                                    return d[schemaFieldName].toString() === val;
                                });
                                var dialog = dm._openEditDialog(dataItem);

                            });

                            return false;
                        };
                    } else {
                        onCreateClick = function () {
                            var dataItemId = $(this).siblings().find('select').val();
                            var selectRef = $(this).siblings().find('select');

                            var dataStoreId = item.dataStore.id;
                            widget.query("datastore/get", {
                                schema: widget.currentSchema.schemaName,
                                id: dataStoreId,
                                dataItemId: dataItemId
                            }).done(function (data) {
                                widget._openEditDialog(data, item.dataStore.popupItems, item, selectRef);

                            });

                            return false;
                        };

                        onEditClick = function () {
                            var selectRef = $(this).siblings().find('select');
                            widget._openEditDialog({}, item.dataStore.popupItems, item, selectRef);

                            return false;
                        };
                    }

                    var cloneItem = $.extend({}, item);
                    cloneItem.isProcessed = true;
                    item.type = "fieldSet";
                    item.title = undefined;
                    item.children = [
                        cloneItem,
                        {
                            type: "button",
                            title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                            cssClass: 'edit',
                            click: onEditClick
                        },
                        {
                            type: "button",
                            title: "",
                            cssClass: "fa fa-plus",
                            click: onCreateClick
                        }
                    ];
                }

                if (item.type === "file") {
                    item.uploadHanderUrl = widget.elementUrl + "file/upload?schema=" + schema.schemaName + "&fid=" + olFeature.fid + "&field=" + item.name;
                    if (item.hasOwnProperty("name") && olFeature.data.hasOwnProperty(item.name) && olFeature.data[item.name]) {
                        item.dbSrc = olFeature.data[item.name];
                        if (schema.featureType.files) {
                            $.each(schema.featureType.files, function (k, fileInfo) {
                                if (fileInfo.field && fileInfo.field == item.name) {
                                    if (fileInfo.formats) {
                                        item.accept = fileInfo.formats;
                                    }
                                }
                            });
                        }
                    }

                }

                if (item.type === 'image') {

                    if (!item.origSrc) {
                        item.origSrc = item.src;
                    }

                    if (item.hasOwnProperty("name") && olFeature.data.hasOwnProperty(item.name) && olFeature.data[item.name]) {
                        item.dbSrc = olFeature.data[item.name];
                        if (schema.featureType.files) {
                            $.each(schema.featureType.files, function (k, fileInfo) {
                                if (fileInfo.field && fileInfo.field == item.name) {

                                    if (fileInfo.uri) {
                                        item.dbSrc = fileInfo.uri + "/" + item.dbSrc;
                                    } else {
                                        item.dbSrc = widget.options.fileUri + "/" + schema.featureType.table + "/" + item.name + "/" + item.dbSrc;
                                    }
                                }
                            });
                        }
                    }

                    var src = item.dbSrc || item.origSrc;
                    if (!item.hasOwnProperty('relative') && !item.relative) {
                        item.src = src;
                    } else {
                        item.src = Mapbender.configuration.application.urls.asset + src;
                    }
                }
            });
        },




        /**
         * Query intersect by bounding box
         *
         * @param request Request for ajax
         * @param bbox Bounding box or some object, which has toGeometry() method.
         * @param debug Drag
         *
         * @returns ajax XHR object
         *
         * @private
         *
         */
        _queryIntersect: function (request, bbox, debug) {
            var widget = this;
            var geometry = bbox.toGeometry();
            var _request = $.extend(true, {intersectGeometry: geometry.toString()}, request);

            if (debug) {
                if (!widget._boundLayer) {
                    widget._boundLayer = new OpenLayers.Layer.Vector("bboxGeometry");
                    widget.map.addLayer(widget._boundLayer);
                }

                var feature = new OpenLayers.Feature.Vector(geometry);
                widget._boundLayer.addFeatures([feature], null, {
                    strokeColor: "#ff3300",
                    strokeOpacity: 0,
                    strokeWidth: 0,
                    fillColor: "#FF9966",
                    fillOpacity: 0.1
                });
            }
            return widget.query('select', _request).done(function (featureCollection) {
                var schema = widget.options.schemes[_request["schema"]];
                schema._onFeatureCollectionLoaded(featureCollection, this);
            });

        },



        /**
         * Highlight feature on the map
         *
         * @param {(OpenLayers.Feature.Vector)} feature
         * @param {boolean} highlight
         * @private
         */
        _highlightFeature: function (feature, highlight) {


            if (!feature || !feature.layer) {
                return;
            }
            var layer = feature.layer;

            if (feature.renderIntent && feature.renderIntent === 'invisible') {
                return;
            }

            var isFeatureVisible = _.contains(layer.features, feature);
            var features = [];

            if (isFeatureVisible) {
                features.push(feature);
            } else {
                _.each(layer.features, function (_feature) {
                    if (_feature.cluster && _.contains(_feature.cluster, feature)) {
                        features.push(_feature);
                        return false;
                    }
                });
            }
            _.each(features, function (feature) {
                var styleId = feature.styleId || 'default';
                if (feature.attributes && feature.attributes.label) {
                    layer.drawFeature(feature, highlight ? 'labelTextHover' : 'labelText');
                } else {
                    if (highlight) {
                        layer.drawFeature(feature, 'select');
                    } else {
                        if (feature.selected) {
                            layer.drawFeature(feature, 'selected');
                        } else {
                            layer.drawFeature(feature, styleId);
                        }
                    }
                }
            });

            // layer.renderer.textRoot = layer.renderer.vectorRoot;
        },

        /**
         * Get target OpenLayers map object
         *
         * @returns  {OpenLayers.Map}
         */
        getMap: function () {
            return this.map;
        },



        /**
         * Open feature edit dialog
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
         */
        exportGeoJson: function (feature) {
            var widget = this;
            widget.query('export', {
                schema: widget.currentSchema.schemaName,
                feature: feature,
                format: 'GeoJSON'
            }).done(function (response) {

            })
        },

        /**
         * Find schema definition by open layer object
         *
         * @param layer
         */
        findSchemaByLayer: function (layer) {
            return _.find(this.options.schemes, {layer: layer});
        },

        /**
         * Update cluster strategies
         */
        updateClusterStrategies: function () {

            var widget = this;
            var options = widget.options;
            var scale = Math.round(widget.map.getScale());
            var clusterSettings;
            var closestClusterSettings;

            $.each(options.schemes, function (i, schema) {
                clusterSettings = null;

                if (!schema.clustering) {
                    return
                }

                $.each(schema.clustering, function (y, _clusterSettings) {
                    if (_clusterSettings.scale == scale) {
                        clusterSettings = _clusterSettings;
                        return false;
                    }

                    if (_clusterSettings.scale < scale) {
                        if (closestClusterSettings && _clusterSettings.scale > closestClusterSettings.scale) {
                            closestClusterSettings = _clusterSettings;
                        } else {
                            if (!closestClusterSettings) {
                                closestClusterSettings = _clusterSettings;
                            }
                        }
                    }
                });

                if (!clusterSettings && closestClusterSettings) {
                    clusterSettings = closestClusterSettings
                }

                if (clusterSettings) {

                    if (clusterSettings.hasOwnProperty('disable') && clusterSettings.disable) {
                        schema.clusterStrategy.distance = -1;
                        var features = schema.layer.features;
                        schema.reloadFeatures([]);
                        schema.clusterStrategy.deactivate();
                        //schema.layer.redraw();
                        schema.isClustered = false;
                        schema.reloadFeatures(features);

                    } else {
                        schema.clusterStrategy.activate();
                        schema.isClustered = true;
                    }
                    if (clusterSettings.hasOwnProperty('distance')) {
                        schema.clusterStrategy.distance = clusterSettings.distance;
                    }

                } else {
                    //schema.clusterStrategy.deactivate();
                }
            });
        },

        /**
         * Get schema style map
         *
         * @param schema
         * @returns {OpenLayers.StyleMap}
         */
        getSchemaStyleMap: function (schema) {
            var widget = this;
            var styles = schema.styles || {};
            for (var k in widget.styles) {
                styles[k] = new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style[k], styles[k] || widget.styles[k]));
            }
            return new OpenLayers.StyleMap(styles, {extendDefault: true});
        },

        /**
         * Find olFeature schema by olFeature data
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
         * @returns {*}
         */
        findFeatureSchema: function (olFeature) {
            var widget = this;
            var options = widget.options;
            return _.find(options.schemes, {layer: olFeature.layer});
        },





        /**
         * Get OL feature by X:Y coordinates.
         *
         * Dirty but works.
         *
         * @param x
         * @param y
         * @returns {Array}
         * @private
         */
        _getFeaturesFromEvent: function (x, y) {
            var features = [], targets = [], layers = [];
            var layer, target, feature, i, len;
            var map = this.map;

            //map.resetLayersZIndex();

            // go through all layers looking for targets
            for (i = map.layers.length - 1; i >= 0; --i) {
                layer = map.layers[i];
                if (layer.div.style.display !== "none") {
                    if (layer === this.activeLayer) {
                        target = document.elementFromPoint(x, y);
                        while (target && target._featureId) {
                            feature = layer.getFeatureById(target._featureId);
                            if (feature) {
                                features.push(feature);
                                target.style.visibility = 'hidden';
                                targets.push(target);
                                target = document.elementFromPoint(x, y);
                            } else {
                                target = false;
                            }
                        }
                    }
                    layers.push(layer);
                    layer.div.style.display = "none";
                }
            }

            // restore feature visibility
            for (i = 0, len = targets.length; i < len; ++i) {
                targets[i].style.display = "";
                targets[i].style.visibility = 'visible';
            }

            // restore layer visibility
            for (i = layers.length - 1; i >= 0; --i) {
                layers[i].div.style.display = "block";
            }

            //map.resetLayersZIndex();
            return features;
        },





        /**
         *
         * @param dataItem
         * @param formItems
         * @param {Scheme} schema
         * @param ref
         * @returns {*|jQuery|HTMLElement}
         * @private
         */
        _openEditDialog: function (dataItem, formItems, schema, ref) {
            var widget = this;

            var schemaName = this.schemaName;
            var widget = this;
            var uniqueKey = schema.dataStore.uniqueId;
            var textKey = schema.dataStore.text;
            var buttons = [];

            if (widget.currentPopup.currentPopup) {
                widget.currentPopup.currentPopup.popupDialog('close');
                widget.currentPopup.currentPopup = null;
            }

            var saveButton = {
                text: Mapbender.DigitizerTranslator.translate("feature.save", false),
                click: function () {
                    widget.saveForeignDataStoreItem(dataItem);
                }
            };
            buttons.push(saveButton);

            buttons.push({

                text: Mapbender.DigitizerTranslator.translate("feature.remove.title", false),
                class: 'critical',
                click: function () {

                    var uniqueIdKey = schema.dataStore.uniqueId;
                    widget.query('datastore/remove', {
                        schema: dataItem.item.dataStoreLink.name,
                        dataItemId: dataItem[uniqueIdKey],
                        dataStoreLinkFieldName: schema.dataStoreLink.fieldName,
                        linkId: dataItem[dataItem.item.dataStoreLink.fieldName]

                    }).done(function (response) {

                        if (response.processedItem.hasOwnProperty('errors')) {
                            $(dialog).enableForm();
                            $.each(response.errors, function (i, error) {
                                $.notify(error.message, {
                                    title: 'API Error',
                                    autoHide: false,
                                    className: 'error'
                                });
                                console.error(error.message);
                            });
                            return;
                        }
                        var data = response.dataItems;
                        var tableApi = $(dialog).data('table').resultTable('getApi');
                        var item = $(dialog).data('table').data('item');
                        if (Object.prototype.toString.call(data) === '[object Array]') {
                            var a = [];
                            _.each(data, function (e, i) {
                                if (e.hasOwnProperty('attributes')) {
                                    e.attributes.item = item;
                                    a.push(e.attributes);
                                }
                            });

                            data = a;

                        } else {
                            if (data.hasOwnProperty('attributes')) {
                                data = [data.attributes];

                            }

                        }
                        tableApi.clear();
                        tableApi.rows.add(data);
                        tableApi.draw();
                        widget.currentPopup.currentPopup.popupDialog('close');
                        widget.currentPopup.currentPopup = null;
                        $.notify(Mapbender.DigitizerTranslator.translate("feature.remove.successfully", false), 'info');

                    })
                }
            });

            buttons.push({
                text: Mapbender.DigitizerTranslator.translate("cancel"),
                click: function () {
                    widget.currentPopup.currentPopup.popupDialog('close');
                    widget.currentPopup.currentPopup = null;
                }
            });

            var dialog = $("<div/>");
            dialog.on("popupdialogopen", function (event, ui) {
                setTimeout(function () {
                    dialog.formData(dataItem);

                }, 1);
            });

            /*   if(!schema.elementsTranslated) {
             translateStructure(widget.currentSchema.formItems);
             schema.elementsTranslated = true;
             } */

            DataUtil.eachItem(widget.currentSchema.formItems, function (item) {
                if (item.type === "file") {
                    item.uploadHanderUrl = widget.elementUrl + "file-upload?schema=" + schema.schemaName + "&fid=" + dataItem.fid + "&field=" + item.name;
                    if (item.hasOwnProperty("name") && dataItem.data.hasOwnProperty(item.name) && dataItem.data[item.name]) {
                        item.dbSrc = dataItem.data[item.name];
                        if (schema.featureType.files) {
                            $.each(schema.featureType.files, function (k, fileInfo) {
                                if (fileInfo.field && fileInfo.field == item.name) {
                                    if (fileInfo.formats) {
                                        item.accept = fileInfo.formats;
                                    }
                                }
                            });
                        }
                    }

                }

                if (item.type === 'image') {

                    if (!item.origSrc) {
                        item.origSrc = item.src;
                    }

                    if (item.hasOwnProperty("name") && dataItem.data.hasOwnProperty(item.name) && dataItem.data[item.name]) {
                        item.dbSrc = dataItem.data[item.name];
                        if (schema.featureType.files) {
                            $.each(schema.featureType.files, function (k, fileInfo) {
                                if (fileInfo.field && fileInfo.field === item.name) {

                                    if (fileInfo.uri) {
                                        item.dbSrc = fileInfo.uri + "/" + item.dbSrc;
                                    } else {
                                    }
                                }
                            });
                        }
                    }

                    var src = item.dbSrc ? item.dbSrc : item.origSrc;
                    if (item.relative) {
                        item.src = src.match(/^(http[s]?\:|\/{2})/) ? src : Mapbender.configuration.application.urls.asset + src;
                    } else {
                        item.src = src;
                    }
                }

            });
            /*  if(schema.popup.buttons) {
             buttons = _.union(schema.popup.buttons, buttons);
             } */
            var popupConfig = _.extend({

                title: Mapbender.DigitizerTranslator.translate("feature.attributes"),

                width: widget.featureEditDialogWidth,
            }, schema.popup);

            popupConfig.buttons = buttons;

            dialog.generateElements({children: formItems});
            dialog.popupDialog(popupConfig);
            dialog.addClass("data-store-edit-data");
            widget.currentPopup.currentPopup = dialog;
            dialog.parentDialog = widget.currentPopup;
            dialog.data('schema', schema);
            dialog.data('table', ref);

            return dialog;
        },

        /**
         *
         * @param dataItem
         * @returns {boolean}
         */

        saveForeignDataStoreItem: function (dataItem) {

            var widget = this;
            var dialog = widget.currentPopup.currentPopup;
            var uniqueIdKey = dataItem.item.dataStore.uniqueId;
            var isNew = dataItem[uniqueIdKey] === null;
            var formData = dialog.formData();
            var schema = dialog.data('schema');
            debugger;
            if (!isNew) {

                formData[uniqueIdKey] = dataItem[uniqueIdKey];
                dataItem['linkId'] = dataItem[schema.dataStoreLink.fieldName];

            } else {
                delete formData[uniqueIdKey];

                formData[schema.dataStoreLink.fieldName] = dataItem.linkId;

            }
            var errorInputs = $(".has-error", dialog);
            var hasErrors = errorInputs.size() > 0;
            if (hasErrors) {
                return false;

            }

            $(dialog).disableForm();

            widget.query('datastore/save', {
                schema: dataItem.item.dataStoreLink.name,
                dataItem: formData,
                dataItemId: dataItem[uniqueIdKey],
                linkId: dataItem.linkId,
                dataStoreLinkFieldName: schema.dataStoreLink.fieldName
            }).done(function (response) {
                if (response.processedItem.hasOwnProperty('errors')) {
                    $(dialog).enableForm();
                    $.each(response.errors, function (i, error) {
                        $.notify(error.message, {
                            title: 'API Error',
                            autoHide: false,
                            className: 'error'
                        });
                        console.error(error.message);
                    });
                    return;
                }
                var data = response.dataItems;
                var tableApi = $(dialog).data('table').resultTable('getApi');
                var item = $(dialog).data('table').data('item');
                if (Object.prototype.toString.call(data) === '[object Array]') {
                    var a = [];
                    _.each(data, function (e, i) {
                        if (e.hasOwnProperty('attributes')) {
                            e.attributes.item = item;
                            a.push(e.attributes);
                        }
                    });

                    data = a;

                } else {
                    if (data.hasOwnProperty('attributes')) {
                        data = [data.attributes];

                    }

                }
                tableApi.clear();
                tableApi.rows.add(data);
                tableApi.draw();

                widget.currentPopup.currentPopup.popupDialog('close');
                widget.currentPopup.currentPopup = null;
                $(dialog).enableForm();
                $.notify(Mapbender.DigitizerTranslator.translate("feature.save.successfully", false), 'info');
            });

        },

        save: function (dataItem) {
            debugger;
            //dataItem.uniqueId

        },

        /**
         * Digitizer API connection query
         *
         * @param uri suffix
         * @param request query
         * @return xhr jQuery XHR object
         * @version 0.2
         */
        query: function (uri, request) {
            var widget = this;
            return $.ajax({
                url: widget.elementUrl + uri,
                type: 'POST',
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                data: JSON.stringify(request)
            }).fail(function (xhr) {
                // this happens on logout: error callback with status code 200 'ok'
                if (xhr.status === 200 && xhr.getResponseHeader("Content-Type").toLowerCase().indexOf("text/html") >= 0) {
                    window.location.reload();
                }
            }).fail(function (xhr) {
                if (xhr.statusText === 'abort') {
                    return;
                }
                var errorMessage = Mapbender.DigitizerTranslator.translate('api.query.error-message');
                var errorDom = $(xhr.responseText);

                // https://stackoverflow.com/a/298758
                var exceptionTextNodes = $('.sf-reset .text-exception h1', errorDom).contents().filter(function () {
                    return this.nodeType === (Node && Node.TEXT_NODE || 3) && ((this.nodeValue || '').trim());
                });
                if (exceptionTextNodes && exceptionTextNodes.length) {
                    errorMessage = [errorMessage, exceptionTextNodes[0].nodeValue.trim()].join("\n");
                }
                $.notify(errorMessage, {
                    autoHide: false
                });
            });
        },

        activate: function () {
            var widget = this;
            widget.query('getConfiguration').done(function (response) {
                _.each(response.schemes, function (schema, schemaName) {
                    widget.options.schemes[schemaName].formItems = response.schemes[schemaName].formItems
                });

                widget.options.__disabled = false;
                widget.currentSchema.activateSchema();


            })

        },

        deactivate: function () {
            var widget = this;
            // clear unsaved features to prevent multiple confirmation popups
            //widget.unsavedFeatures = {};
            var always = function () {
                widget.options.__disabled = true;
                if (!widget.currentSchema.displayOnInactive) {
                    widget.currentSchema.deactivateSchema();
                }
            };
            always();

        },




        /**
         *
         * @param featureTypeName
         */

        refreshConnectedDigitizerFeatures: function (featureTypeName) {
            var widget = this;
            $(".mb-element-digitizer").not(".mb-element-data-manager").each(function (index, element) {
                var schemes = widget.options.schemes;
                _.each(schemes, function (schema, key) {
                    if (key === featureTypeName) {

                        if (schema.layer) {
                            schema._getData();
                        }
                        return true;
                    }
                }.bind(this))
            }.bind(this))


        },

        /**
         * Download file by feature and his attribute name
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature OpenLayers
         * @param {String} attributeName
         */
        download: function (feature, attributeName) {
            var widget = this;
            /**@type {Scheme} */
            var schema = widget.currentSchema;
            var attributes = feature.attributes;
            var tableName = schema.featureType.table;
            var relativeWebPath = Mapbender.configuration.application.urls.asset;
            window.open(relativeWebPath + widget.options.fileUri + '/' + tableName + '/' + attributeName + '/' + attributes[attributeName]);

        }
    });

})(jQuery);
