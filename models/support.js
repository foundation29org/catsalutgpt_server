// Support schema
'use strict'

const mongoose = require ('mongoose');
const Schema = mongoose.Schema

const { conndbaccounts } = require('../db_connect')

const SupportSchema = Schema({
	subject: String,
	description: String,
	email: String,
	date: {type: Date, default: Date.now}
})

module.exports = conndbaccounts.model('Support',SupportSchema)
// we need to export the model so that it is accessible in the rest of the app
