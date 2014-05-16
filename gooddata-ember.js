/* Copyright (C) 2007-2013, GoodData(R) Corporation. All rights reserved. */
/* gooddata-ember - v0.0.2 */
/* 2014-05-16 13:51:20 */
/* Latest git commit: "f1c35ad" */

(function(window, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else if (typeof exports === 'object') {
    // CommonJS
    module.exports = factory();
  } else {
    // Browser Global (gooddata is out global library identifier)
    window.gooddata = factory();
  }
}(this, function() {
// Copyright (C) 2007-2014, GoodData(R) Corporation. All rights reserved.
define('metadata',['gooddata', 'ember'], function(gooddata, Ember) {
    

    /**
     * Abstract base class for platform metadata
     */
    Metadata = Ember.Object.extend({
        type: Ember.required(),

        // Metadata classes store their uri in different properties depending on the type.
        // This provides us a generic way to retrieve the object's uri.
        uri: Ember.computed.any('meta.uri', 'meta.link', 'links.self'),

        author: function() {
            var self = this;

            return this.getAuthor().then(function(author) {
                self.set('author', author);
                return author;
            });
        }.property('meta.author'),

        usedBy: function() {
            var self = this;

            return this.getUsedBy().then(function(usedBy) {
                // figure out whether object is actually used
                // and cache result
                if (usedBy.nodes.length === 0) {
                    usedBy.isUsed = false;
                } else {
                    usedBy.isUsed = true;
                }
                self.set('usedBy', usedBy);

                return usedBy;
            });
        }.property('uri'),

        /**
         * Attempts to delete this metadata object
         *
         * @method delete
         * @return {Promise} The promise of the delete request
         */
        delete: function() {
            var uri = this.get('uri');
            return gooddata.xhr.ajax(uri, {type: 'DELETE'});
        },

        /**
         * Reloads the metadata object from the GoodData API.
         *
         * @method reload
         * @return {Ember.RSVP.Promise} Promise resolving to the reloaded object
         */
        reload: function() {
            var uri  = this.get('uri'),
                type = this.get('type'),
                self = this;

            return new Ember.RSVP.Promise(function(resolve, reject) {
                if (uri) {
                    gooddata.xhr.get(uri).then(function(response) {
                        if (response && response[type]) {
                            resolve(self.setProperties(response[type]));
                        }
                    }, function(error) {
                        reject(error);
                    });
                } else {
                    throw "Error: could not determine object uri";
                }
            });
        },

        getAuthor: function() {
            var uri = this.get('meta.author');

            return App.User.load(uri).then(function(author) {
                // platform only return first name and last name,
                // so we add the full name here ourselves
                author.fullName = author.get('firstName') + ' ' +
                                  author.get('lastName');

                return author;
            });
        },

        /**
         * Retrieves information on which other objects this object is used by.
         *
         * @method getUsedBy
         * @return {Ember.RSVP.Promise} Promise resolving to a Ember.Object 
         */
        getUsedBy: function() {
            var uri  = this.get('uri'),
                self = this;

            return new Ember.RSVP.Promise(function(resolve, reject) {
                if (uri) {
                    gooddata.xhr.get(uri.replace('/obj/', '/usedby/')).then(function(response) {
                        if (response && response.usedby) {
                            resolve(Ember.Object.create(response.usedby));
                        }
                    }, function(error) {
                        reject(error);
                    });
                } else {
                    throw "Error: could not determine object uri";
                }
            });
        }
    });

    /*
     * Static methods for metadata class
     */
    Metadata.reopenClass({
        /**
         * Create a metadata object by loading it from the given uri.
         *
         * @method load
         * @static
         *
         * @param {String} uri GoodData object URI
         * @return {Ember.RSVP.Promise} Promise resolving to new object
         */
        load: function(uri) {
            var metadata = this;

            // find out our type
            if (!this.type) {
                this.type = this.create().get('type');
            }

            // return a promise that will resolve to the requested platform object
            return new Ember.RSVP.Promise(function(resolve, reject) {
                if (metadata.type) {
                    gooddata.xhr.get(uri).then(function(response) {
                        if (response && response[metadata.type]) {
                           resolve(metadata.create(response[metadata.type]));
                        }
                    }, function(error) {
                        reject(error);
                    });
                } else {
                    throw "Error: could not determine type";
                }
            });
        }
    });

    return Metadata;

});

// Copyright (C) 2007-2014, GoodData(R) Corporation. All rights reserved.
define('user',['gooddata', 'ember'], function(gooddata, Ember) {
    

    /**
     * User class
     */
    User = App.Metadata.extend({
        type: 'accountSetting',

        projects: function() {
            var self = this;

            return this.getProjects().then(function(projects) {
                self.set('projects', projects);
                return projects;
            });
        }.property('links.projects'),

        /**
         * Retrieves all projects for the current user
         *
         * @method getProjects
         * @return {Ember.RSVP.Promise} Promise resolving to an array of projects
         */
        getProjects: function() {
            var uri = this.get('links.projects');

            return new Ember.RSVP.Promise(function(resolve, reject) {
                if (uri) {
                    gooddata.xhr.get(uri).then(function(result) {
                        if (result && result.projects) {
                            var projects = result.projects.map(function(entry) {
                                return App.Project.create(entry.project);
                            });
                            resolve(projects);
                        }
                    }, function(error) {
                        reject(error);
                    });
                } else {
                    throw "Error: could not find projects link";
                }
            });
        }
    });

    User.reopenClass({
        /**
         * Loads the currently logged in user
         *
         * @method currentUser
         * @return {Ember.RSVP.Promise} Promise resolving to the current user
         */
        currentUser: function() {
            return this.load('/gdc/account/profile/current');
        }
    });

    return User;

});

// Copyright (C) 2007-2014, GoodData(R) Corporation. All rights reserved.
define('project',['gooddata', 'ember'], function(gooddata, Ember) {
    

    /**
     * Project class
     */
    Project = App.Metadata.extend({
        type: 'project',

        id: function() {
            var uri = this.get('uri');

            if (uri) {
                var parts = uri.split('/');
                return parts[parts.length - 1];
            }
        }.property('uri'),

        metrics: function() {
            var self = this;

            return this.getMetrics().then(function(metrics) {
                self.set('metrics', metrics);
                return metrics;
            });
        }.property(),

        /**
         * Loads all metrics for the project.
         *
         * @method getMetrics
         *
         * @return {Ember.RSVP.Promise} Promise resolving to an array of metrics
         */
        getMetrics: function() {
            var md = this.get('links.metadata');

            return new Ember.RSVP.Promise(function(resolve, reject) {
                if (md) {
                    gooddata.xhr.get(md + '/query/metrics').then(function(result) {
                        if (result && result.query && result.query.entries) {
                            var metrics = result.query.entries.map(function(metric) {
                                return App.Metric.create({ meta: metric });
                            });
                            resolve(metrics);
                        }
                    }, function(error) {
                        reject(error);
                    });
                } else {
                    throw "Error: could not find metadata link";
                }
            });
        }
    });

    /*
     * Static methods for Project class
     */
    Project.reopenClass({
        /**
         * Overloads App.Metadata.load with support for project ids
         *
         * @param {String} uri_or_id A project uri or project id
         * @return {Ember.RSVP.Promise} Promise resolving to the requested project
         */
        load: function(uri_or_id) {
            var uri = uri_or_id;

            // check if we got a uri or an id
            if (uri && uri.indexOf('/') == -1) {
                uri = '/gdc/projects/' + uri;
            }

            return this._super(uri);
        }
    });

    return Project;

});

// Copyright (C) 2007-2014, GoodData(R) Corporation. All rights reserved.
define('metric',['gooddata', 'ember'], function(gooddata, Ember) {
    

    /**
     * Metric class
     */
    Metric = App.Metadata.extend({
        type: 'metric',

        dashboards: function() {
            var nodes = this.get('usedBy.nodes');
            if (nodes) {
                return nodes.filterBy('category', 'projectDashboard');
            }
        }.property('usedBy')
    });

    return Metric;

});

// Copyright (C) 2007-2014, GoodData(R) Corporation. All rights reserved.
define('gooddata-ember',[
    'metadata',
    'user',
    'project',
    'metric'
], function(
    Metadata,
    User,
    Project,
    Metric
) {
    

    /**
     * # GoodData Ember
     */
    return {
        Metadata: Metadata,
        User: User,
        Project: Project,
        Metric: Metric
    };

});

  // Ask loader to synchronously require the
  // module value for 'gooddata' here and return it as the
  // value to use for the public API for the built file.
  return require('gooddata-ember');
}));
