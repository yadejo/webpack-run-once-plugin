function traverseArray(prev, cur, key) {
    let res = [];
    for (let i = prev.length; i < cur.length; i++) {
        res.push(cur[i]);
    }
    return res;
}

function deepClone(obj) {
    let res = {};
    Object.keys(obj).forEach(item => {
        if (Array.isArray(obj[item])) {
            res[item] = [];
            obj[item].forEach(k => res[item].push(k));
        } else {
            res[item] = Object.assign(obj[item]);
        }
    });
    return res;
}

class WebpackRunOncePlugin {
    constructor(pluginList) {
        this._isRunned = false;
        this._cleanedup = false;
        let _record = {};

        //select unique plugin cases
        this.pluginList = pluginList.filter(function(plugin) {
            if (_record.hasOwnProperty(plugin.name)) {
                console.warn(
                    'The plugin case "' +
                        plugin.name +
                        '" already exists and only the first one will be executed. Please use unique names for each plugin case.'
                );
                return false;
            }
            _record[plugin.name] = 1;
            return true;
        });
        this.additionalEnv = {};
    }

    apply(compiler) {
        compiler.plugin(
            'environment',
            function environmentEvent(compilation, callback) {
                //this event only execute once
                if (!this._isRunned) {
                    this.pluginList.forEach(item => {
                        let { plugin, option } = item;
                        item.additionalEnv = {};
                        let before, after;
                        //preserve compiler plugins status both before and after
                        before = deepClone(compiler.options.plugins);
                        compiler.apply.apply(compiler, [new plugin(option)]);
                        after = deepClone(compiler.options.plugins);

                        //record newly installed plugins
                        Object.keys(after).forEach(key => {
                            if (!before.hasOwnProperty(key)) {
                                item.additionalEnv[key] = traverseArray(
                                    [],
                                    after[key]
                                );
                            } else {
                                item.additionalEnv[key] = traverseArray(
                                    item.additionalEnv[key]
                                        ? item.additionalEnv[key]
                                        : before[key],
                                    after[key],
                                    key
                                );
                            }
                        });
                    });
                }
            }.bind(this)
        );
        compiler.plugin(
            'after-emit',
            function afterCompileEvent(compilation, cb) {
                if (this._isRunned && !this._cleanedup) {
                    let compilerPlugins = compiler.options.plugins;
                    //clear all the newly installed plugins after the first run
                    this.pluginList.forEach(item => {
                        let plugins = item.additionalEnv;
                        Object.keys(plugins).forEach(key => {
                            if (plugins[key].length) {
                                let comp = compilerPlugins[key];
                                for (let fn of plugins[key]) {
                                    var pos = comp.indexOf(fn);
                                    if (pos != -1) comp.splice(pos, 1);
                                }
                            }
                        });
                    });

                    this._cleanedup = true;
                }
                else {
                    this._isRunned = true;
                }
                cb();
            }.bind(this)
        );
    }
}

module.exports = WebpackRunOncePlugin;
