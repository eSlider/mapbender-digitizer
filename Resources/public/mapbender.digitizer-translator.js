(function($) {

    Mapbender.DigitizerTranslator = {

        /**
         * Regular Expression to get checked if string should be translated
         *
         * @type {RegExp}
         */
        translationReg: /^trans:\w+\.(\w|-|\.{1}\w+)+\w+$/,

        translate: function (title, withoutSuffix) {
            return Mapbender.trans(withoutSuffix ? title : "mb.digitizer." + title);
        },

        translateObject: function (items) {
            for (var k in items) {
                var item = items[k];
                if (typeof item === "string" && item.match(this.translationReg)) {
                    items[k] = Mapbender.DigitizerTranslator.translate(item.split(':')[1], true);
                } else if (typeof item === "object") {
                    this.translateObject(item);
                }
            }
            return item;
        },


        /**
         * Check and replace values recursive if they should be translated.
         * For checking used "translationReg" variable
         *
         *
         * @param items
         */
        translateStructure: function (items) {
            var isArray = items instanceof Array;
            for (var k in items) {
                if (isArray || k === "children") {
                    this.translateStructure(items[k]);
                } else {
                    if (typeof items[k] == "string" && items[k].match(this.translationReg)) {
                        items[k] = this.translate(items[k].split(':')[1], true);
                    }
                }
            }

            return items;
        },

        tableTranslations: function() {
            return {
                sSearch: this.translate("search.title") + ':',
                sEmptyTable: this.translate("search.table.empty"),
                sZeroRecords: this.translate("search.table.zerorecords"),
                sInfo: this.translate("search.table.info.status"),
                sInfoEmpty: this.translate("search.table.info.empty"),
                sInfoFiltered: this.translate("search.table.info.filtered")
            }
        },


        toolsetTranslations: function (geomType) {


            var toolSetTranslations = {
                drawPoint: "Punkt setzen",
                drawLine: "Linie zeichnen",
                drawPolygon: "Polygon zeichnen",
                drawRectangle: "Rechteck zeichen",
                drawCircle: "Kreis zeichen",
                drawEllipse: "Ellipse zeichen",
                drawDonut: "Polygon mit Enklave zeichnen",
                selectAndEditGeometry: "Objekt Position/Größe beabeiten",
                moveGeometry: "Objekt bewegen",
                selectGeometry: "Objekt selektieren",
                removeSelected: "Selektierte objekte löschen",
                removeAll: "Alle Objekte löschen"
            };


            //var toolSetTranslations =  {};

            var translationPrefix = 'mb.digitizer.toolset.' + geomType + '.';

            _.each(Mapbender.i18n, function (v, k) {
                if (k.indexOf(translationPrefix) === 0) {
                    var shortKeyName = k.split(translationPrefix)[1];
                    toolSetTranslations[shortKeyName] = v;
                }
            });

            return toolSetTranslations;
        },


    };
})(jQuery);