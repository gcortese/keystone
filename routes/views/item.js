var keystone = require('../../'),
	_ = require('underscore'),
	async = require('async');

exports = module.exports = function(req, res) {
	
	//var itemQuery = req.list.model.findById(req.params.item);
	var itemQuery,
		isCustomView = req.query.custom,
		customView;
	//FABRIZIO
	if (req.list.get('owner') && !req.user.isAdmin)
	{
		itemQuery = req.list.model.findById(req.params.item).where(req.list.get('owner'), req.user);
	}
	else 
	{
		itemQuery = req.list.model.findById(req.params.item);
	}
	//FABRIZIO
	if (req.list.tracking && req.list.tracking.createdBy) {
		itemQuery.populate(req.list.tracking.createdBy);
	}
	
	if (req.list.tracking && req.list.tracking.updatedBy) {
		itemQuery.populate(req.list.tracking.updatedBy);
	}
	
	itemQuery.exec(function(err, item) {
		
		if (!item) {
			req.flash('error', 'Item ' + req.params.item + ' could not be found.');
			return res.redirect('/keystone/' + req.list.path);
		}
		
		var viewLocals = {
			validationErrors: {}
		};
		
		var renderView = function() {
			
			var relationships = _.values(_.compact(_.map(req.list.relationships, function(i) {
				if (i.isValid) {
					return _.clone(i);
				} else {
					keystone.console.err('Relationship Configuration Error', 'Relationship: ' + i.path + ' on list: ' + req.list.key + ' links to an invalid list: ' + i.ref);
					return null;
				}
			})));
				
			async.each(relationships, function(rel, done) {
				
				// TODO: Handle invalid relationship config
				rel.list = keystone.list(rel.ref);
				rel.sortable = (rel.list.get('sortable') && rel.list.get('sortContext') === req.list.key + ':' + rel.path);
				
				// TODO: Handle relationships with more than 1 page of results
				var q = rel.list.paginate({ page: 1, perPage: 100 })
					.where(rel.refPath).equals(item.id)
					.sort(rel.list.defaultSort);
					
				// rel.columns = _.reject(rel.list.defaultColumns, function(col) { return (col.type == 'relationship' && col.refList == req.list) });
				rel.columns = rel.list.defaultColumns;
				rel.list.selectColumns(q, rel.columns);
				
				q.exec(function(err, results) {
					rel.items = results;
					done(err);
				});
				
			}, function(err) { //eslint-disable-line no-unused-vars, handle-callback-err
				
				// TODO: Handle err
				
				var showRelationships = _.some(relationships, function(rel) {
					return rel.items.results.length;
				});
				
				var appName = keystone.get('name') || 'Keystone';
				
				var section;//FABRIZIO
				if(req.user.isAdmin)
				{
					section = keystone.nav.by.list[req.list.key] || {};
				}
				else 
				{
					section = 'dashboard';
				}
				
				customView = 'item';//FABRIZIO
				if (isCustomView)
				{
					customView = 'itemCustom';
				}
				
				keystone.render(req, res, customView, _.extend(viewLocals, {
					section: section,
					subSection: req.list.path,
					//title: appName + ': ' + req.list.singular + ': ' + req.list.getDocumentName(item),
					title: req.list.singular + ' - ' + appName,
					page: 'item',
					list: req.list,
					item: item,
					relationships: relationships,
					showRelationships: showRelationships
				}));
				
			});
			
		};
		
		if (req.method === 'POST' && req.body.action === 'updateItem' && !req.list.get('noedit')) {
			
			if (!keystone.security.csrf.validate(req)) {
				console.error('CSRF failure', req.method, req.body);
				req.flash('error', 'There was a problem with your request, please try again.');
				return renderView();
			}
			
			item.getUpdateHandler(req).process(req.body, { flashErrors: true, logErrors: true }, function(err) {
				if (err) {
					return renderView();
				}
				req.flash('success', 'Your changes have been saved.');
				
				//FABRIZIO aggiunto if
				if (req.query.custom)
				{
					return res.redirect('/keystone/' + req.list.path + '/' + item.id + '?custom=true');
				}
				else 
				{
					return res.redirect('/keystone/' + req.list.path + '/' + item.id);
				}
			});
			
			
		} else {
			renderView();
		}
		
	});
	
};
