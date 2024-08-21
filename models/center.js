// Support schema
'use strict'

const mongoose = require ('mongoose');
const Schema = mongoose.Schema

const { conndbaccounts } = require('../db_connect')

const CenterSchema = Schema({
	myuuid: String,
	centro: String,
	date: {type: Date, default: Date.now}
})

module.exports = conndbaccounts.model('Center',CenterSchema)
// we need to export the model so that it is accessible in the rest of the app
