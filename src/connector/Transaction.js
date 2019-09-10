/**
 * Created by yangyxu on 8/20/14.
 */
module.exports = zn.Class({
    events: ['rollback', 'error', 'commit', 'finally'],
    properties: {
        command: null
    },
    methods: {
        init: function (pool){
            this._pool = pool;
            this._queue = zn.queue({});
            this._queue.finally(function (){
                this._connection.release();
                this._connection = null;
                this.destroy();
            }.bind(this));
        },
        begin: function (before, after){
            var _self = this;
            this._queue.push(function (task){
                _self._pool.getConnection(function (err, connection){
                    var _before = before&&before.call(_self, err, connection);
                    if(err){
                        _self.__finally(err);
                    } else {
                        if(_before === false){
                            _self._queue.destroy();
                        } else {
                            _self._connection = connection;
                            task.done(connection);
                        }
                    }
                });
            }).push(function (task, connection){
                connection.query('START TRANSACTION', function (err, rows, fields) {
                    var _after = after && after.call(_self, err, rows, fields);
                    if(err){
                        _self.rollback(err);
                    } else {
                        if(_after === false){
                            _self._queue.destroy();
                        } else {
                            task.done(connection, (_after || rows), fields);
                        }
                    }
                });
            });

            return this;
        },
        block: function (block, after){
            var _self = this;
            if(zn.is(block, 'function')){
                block = block && block.call(this);
            }

            if(block){
                var _tasks = [],
                    _task = null;
                block.each(function (task, index){
                    switch (task[0]) {
                        case 'query':
                            _task = this.__parseQueryTask(task[1], task[2], task[3]);
                            break;
                        case 'insert':
                            _task = this.__parseInsertTask(task[1], task[2], task[3]);
                            break;
                    }

                    //_tasks.push(_task);
                    this._queue.push(_task);
                }, this);
                //this._queue.inserts(_tasks, this, 0);
            }

            return this;
        },
        unshift: function (handler, before, after){
            return this.insert(handler, before, after, 0);
        },
        push: function (handler, before, after){
            return this.insert(handler, before, after, -1);
        },
        insert: function (handler, before, after, index) {
            return this._queue.insert(this.__parseInsertTask(handler, before, after), this, index), this;
        },
        query: function(query, before, after, index){
            if(!query&&!before){ return this; }
            var _task = this.__parseQueryTask(query, before, after);
            if(index){
                this._queue.insert(_task, null, index);
            }else {
                this._queue.push(_task);
            }

            return this;
        },
        commit: function (before, after){
            var _self = this;
            this._queue.push(function (task, connection, rows, fields){
                before && before.call(_self, rows, fields);
                connection.query('COMMIT', function (err, rows, fields){
                    after && after.call(_self, err, rows, fields);
                    var _data = { error: err, rows: rows, fields: fields };
                    if(err){
                        _self.rollback(err);
                    }else {
                        _self.fire('commit', _data);
                        _self.fire('finally', _data);
                        _self._queue.destroy();
                    }
                });
            }).start();

            return this;
        },
        rollback: function (error, callback){
            var _self = this;
            zn.error(error);
            _self._queue.clear();
            _self.fire('rollback');
            _self.__finally(error);
            if(!this._connection){
                return _self._queue.destroy(), this;
            }
            zn.debug('Transaction Query SQL: ROLLBACK');
            this._connection.query('ROLLBACK', function (err, rows, fields){
                if(err){
                    zn.error(err);
                }
                callback && callback.call(_self, err, rows, fields);
                _self._queue.destroy();
            });

            return this;
        },
        __parseInsertTask: function (handler, before, after){
            return function (task, connection, rows, fields){
                var _callback = null;
                if(before){
                    _callback = before.call(this, handler, rows, fields);
                    if(typeof _callback == 'function'){
                        handler = _callback;
                    }
                }
                if(_callback === false){
                    this._queue.destroy();
                } else if(_callback === -1){
                    task.done(connection, rows, fields);
                } else {
                    _callback = handler.call(this, task, connection, rows, fields);
                    if(_callback === false){
                        this.rollback(err);
                    } else {
                        var _after = after && after.call(this, err, rows, fields);
                        if(_after === false){
                            this._queue.destroy();
                        }
                    }
                }
            }.bind(this);
        },
        __parseQueryTask: function (query, before, after){
            return function (task, connection, rows, fields){
                var _callback = null,
                    _tag = query;
                if(before){
                    _callback = before.call(this, query, rows, fields);
                    if(typeof _callback == 'string'){
                        query = _callback;
                    }
                }
                if(_callback === false){
                    this._queue.destroy();
                } else if(_callback === -1){
                    task.done(connection, rows, fields);
                } else {
                    if(_callback && _callback.then && typeof _callback.then == 'function') {
                        _callback.then(function (data){
                            var _after = after && after.call(this, data);
                            if(_after === false){
                                this._queue.destroy();
                            } else {
                                task.done(connection, (_after || data));
                            }
                        }.bind(this), function (err){
                            this.rollback(err);
                        }.bind(this));
                    }else {
                        zn.debug('Transaction Query SQL {0} : '.format(_tag!=query?'['+_tag+']':''), query);
                        connection.query(query, function (err, rows, fields){
                            var _after = after && after.call(this, err, rows, fields);
                            if(err){
                                this.rollback(err);
                            }else {
                                if(_after === false){
                                    this._queue.destroy();
                                } else {
                                    task.done(connection, (_after || rows), fields);
                                }
                            }
                        }.bind(this));
                    }
                }
            }.bind(this);
        },
        __finally: function (error){
            if(error) {
                this.fire('error', error);
            }
            this.fire('finally', error);
        }
    }
});