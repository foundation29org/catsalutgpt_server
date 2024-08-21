// functions for each call of the api on user. Use the user model

'use strict'

// add the user model
const Support = require('../../models/support')
const serviceEmail = require('../../services/email')
const insights = require('../../services/insights')

function sendMsg(req, res){
	let support = new Support()
	//support.type = 'Home form'
	support.subject = 'CatSalutGPT support'
	support.email = req.body.email
	support.description = req.body.description
	support.save((err, supportStored) => {
	})
	// enviamos Email
	serviceEmail.sendMailSupport(req.body.email, req.body.description)
			.then(response => {
				return res.status(200).send({ message: 'Email sent'})
			})
			.catch(response => {
				//create user, but Failed sending email.
				insights.error(response);
				res.status(500).send({ message: 'Fail sending email'})
			})
}

module.exports = {
	sendMsg
}
