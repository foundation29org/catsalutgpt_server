// Support schema
'use strict'

const mongoose = require ('mongoose');
const Schema = mongoose.Schema

const { conndbaccounts } = require('../db_connect')

const VoteSchema = Schema({
	value: String,
	description: String,
	myuuid: String,
	type: String,
	date: {type: Date, default: Date.now}
})

module.exports = conndbaccounts.model('Vote',VoteSchema)
// we need to export the model so that it is accessible in the rest of the app
