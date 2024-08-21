
const config = require('../config')
const insights = require('../services/insights')
const blobOpenDx29Ctrl = require('../services/blobOpenDx29')
const serviceEmail = require('../services/email')
const Center = require('../models/center')
const Generalfeedback = require('../models/generalfeedback')
const Vote = require('../models/vote')
const Top = require('../models/top')
const ApiManagementKey = config.API_MANAGEMENT_KEY;
const axios = require('axios');
const { encodingForModel } = require("js-tiktoken");


async function callOpenAi(req, res) {
  var jsonText = req.body.value;
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const origin = req.get('origin');
  const requestInfo = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    origin: origin,
    body: req.body,
    ip: clientIp,
    params: req.params,
    query: req.query
  };

  try {
    const messages = [{ role: "user", content: jsonText }];
    let requestBody = {
      messages: messages,
      temperature: 0,
      max_tokens: 2000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    };
    let max_tokens = calculateMaxTokens(jsonText);
    // console.log('max_tokens', max_tokens);
    requestBody.max_tokens = max_tokens;
    if (max_tokens > 4000) {
      requestBody.max_tokens = 4096;
    }

    // Realizar la solicitud a Azure API Management
    const result = await axios.post('https://apiopenai.azure-api.net/catsalutgpt/deployments/gpt4o', requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': ApiManagementKey,
      }
    });
    if (!result.data.choices[0].message.content) {
      try {
        serviceEmail.sendMailErrorGPT(req.body.value, result.data.choices, requestInfo)
      } catch (emailError) {
        console.log('Fail sending email');
      }
      res.status(200).send({ result: "error openai" });
    } else {
      try {
        let parsedData;
        // console.log('result', result.data.usage)
        const match = result.data.choices[0].message.content.match(/<diagnosis_output>([\s\S]*?)<\/diagnosis_output>/);
        if (match && match[1]) {
          parsedData = JSON.parse(match[1]);
          return res.status(200).send({ result: 'success', data: parsedData });
        } else {
          console.error("Failed to parse diagnosis output 0");
          throw new Error("Failed to match diagnosis output");
        }
      } catch (e) {
        console.error("Failed to parse diagnosis output", e);
        res.status(200).send({ result: "error" });
      }
    }
  } catch (e) {
    insights.error(e);
    console.log(e)
    if (e.response) {
      console.log(e.response.status);
      console.log(e.response.data);
      if (e.response.data && e.response.data.error && e.response.data.error.type === 'invalid_request_error') {
        res.status(400).send(e.response.data.error);
        return;
      }
    } else {
      console.log(e.message);
    }
    try {
      serviceEmail.sendMailErrorGPT(req.body.value, e, requestInfo);
    } catch (emailError) {
      console.log('Fail sending email');
    }

    res.status(500).send('Internal server error');
  }
}

function calculateMaxTokens(jsonText) {
  const enc = encodingForModel("gpt-4o");
  const patientDescription = extractContent('patient_description', jsonText);
  const patientDescriptionTokens = enc.encode(patientDescription).length;
  //  console.log('patientDescriptionTokens', patientDescriptionTokens);
  let max_tokens = Math.round(patientDescriptionTokens * 4.5);
  max_tokens += 500; // Add extra tokens for the prompt
  return max_tokens;
}

function calculateMaxTokensAnon(jsonText) {
  const enc = encodingForModel("gpt-4o");
  // console.log('jsonText', jsonText)
  // Contar tokens en el contenido relevante
  const patientDescriptionTokens = enc.encode(jsonText).length;
  return patientDescriptionTokens + 100;
}

function extractContent(tag, text) {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

async function callOpenAiQuestions(req, res) {
  const jsonText = req.body.value;
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const origin = req.get('origin');
  const requestInfo = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    origin: origin,
    body: req.body,
    ip: clientIp,
    params: req.params,
    query: req.query
  };

  try {
    const messages = [{ role: "user", content: jsonText }];
    const requestBody = {
      messages: messages,
      temperature: 0,
      max_tokens: 800,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    };

    const result = await axios.post('https://apiopenai.azure-api.net/catsalutgpt/deployments/gpt4o', requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': ApiManagementKey,
      }
    });

    if (!result.data.choices[0].message.content) {
      try {
        serviceEmail.sendMailErrorGPT(req.body.value, result.data.choices, requestInfo)
      } catch (emailError) {
        console.log('Fail sending email');
      }
      res.status(200).send({ result: "error openai" });
    } else {
      res.status(200).send({ result: 'success', data: result.data.choices[0].message.content });
    }
  } catch (e) {
    insights.error(e);
    console.log(e);

    if (e.response) {
      console.log(e.response.status);
      console.log(e.response.data);

      // Asegurarse de que e.response.data.error y e.response.data.error.type están definidos antes de acceder
      if (e.response.data && e.response.data.error && e.response.data.error.type === 'invalid_request_error') {
        res.status(400).send(e.response.data.error);
        return;
      }
    } else {
      console.log(e.message);
    }

    try {
      serviceEmail.sendMailErrorGPT(req.body.value, e, requestInfo);
    } catch (emailError) {
      console.log('Fail sending email');
    }

    res.status(500).send('Internal server error');
  }
}

async function callOpenAiAnonymized(req, res) {
  // Anonymize user message
  var jsonText = req.body.value;
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const origin = req.get('origin');
  const requestInfo = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    origin: origin,
    body: req.body,
    ip: clientIp,
    params: req.params,
    query: req.query
  };
  var anonymizationPrompt = `The task is to anonymize the following medical document by replacing any personally identifiable information (PII) with [ANON-N], 
  where N is the count of characters that have been anonymized. 
  Only specific information that can directly lead to patient identification needs to be anonymized. This includes but is not limited to: 
  full names, addresses, contact details, Social Security Numbers, and any unique identification numbers. 
  However, it's essential to maintain all medical specifics, such as medical history, diagnosis, treatment plans, and lab results, as they are not classified as PII. 
  The anonymized document should retain the integrity of the original content, apart from the replaced PII. 
  Avoid including any information that wasn't part of the original document and ensure the output reflects the original content structure and intent, albeit anonymized. 
  If any part of the text is already anonymized (represented by asterisks or [ANON-N]), do not anonymize it again. 
  Here is the original document between the triple quotes:
  ----------------------------------------
  """
  ${jsonText}
  """
  ----------------------------------------
  ANONYMIZED DOCUMENT:"`;

  try {

    const messages = [
      { role: "user", content: anonymizationPrompt }
    ];

    const requestBody = {
      messages: messages,
      temperature: 0,
      max_tokens: 2000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    };

    let max_tokens = calculateMaxTokensAnon(jsonText);
    // console.log('max_tokens', max_tokens);
    requestBody.max_tokens = max_tokens;
    if (max_tokens > 4000) {
      requestBody.max_tokens = 4096;
    }


    // Realizar la solicitud a Azure API Management
    const result = await axios.post('https://apiopenai.azure-api.net/catsalutgpt/deployments/anonymizedgpt4o', requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': ApiManagementKey,
      }
    });

    let infoTrack = {
      value: result.data,
      myuuid: req.body.myuuid,
      operation: req.body.operation,
      lang: req.body.lang,
      response: req.body.response,
      topRelatedConditions: req.body.topRelatedConditions
    }
    blobOpenDx29Ctrl.createBlobOpenDx29(infoTrack);

    res.status(200).send(result.data)
  } catch (e) {
    insights.error(e);
    console.log(e)
    if (e.response) {
      console.log(e.response.status);
      console.log(e.response.data);
    } else {
      console.log(e.message);
    }
    console.error("[ERROR]: " + e)

    try {
      serviceEmail.sendMailErrorGPT(req.body.value, e, requestInfo)
    } catch (emailError) {
      console.log('Fail sending email');
    }

    res.status(500).send('error')
  }
}

function opinion(req, res) {

  (async () => {
    try {
      let vote = new Vote()
      vote.value = req.body.vote
      vote.myuuid = req.body.myuuid
      vote.type = 'Diseases'
      vote.save((err, voteStored) => {
        res.status(200).send({ send: true, id: voteStored._id })
      })
      blobOpenDx29Ctrl.createBlobOpenVote(req.body);

    } catch (e) {
      insights.error(e);
      console.error("Error opinion: " + e)
      serviceEmail.sendMailErrorGeneral('Error opinion', req.body.value, e)
        .then(response => {

        })
        .catch(response => {
          insights.error(response);
          //create user, but Failed sending email.
          console.log('Fail sending email');
        })

      res.status(500).send(e)
    }

  })();
}

function sendFeedback(req, res) {

  (async () => {
    try {
      blobOpenDx29Ctrl.createBlobFeedbackVoteDown(req.body);
      Vote.findByIdAndUpdate(req.body.voteId, { description: req.body.description }, { new: true }, (err, voteUpdated) => {
        if (err || !voteUpdated) {
          insights.error(err);
          console.log(err)
          var msg = err || 'Error updating vote'
          serviceEmail.sendMailErrorGeneral('Error sendFeedback',req.body.description, msg)
            .then(response => {

            })
            .catch(response => {
              insights.error(response);
              //create user, but Failed sending email.
              console.log('Fail sending email');
            })
        }
      })
      
      serviceEmail.sendMailFeedback(req.body.email, req.body.description, req.body.myuuid)
        .then(response => {

        })
        .catch(response => {
          insights.error(response);
          //create user, but Failed sending email.
          console.log('Fail sending email');
        })

      res.status(200).send({ send: true })
    } catch (e) {
      insights.error(e);
      console.error("Error sendFeedback: " + e)
      serviceEmail.sendMailErrorGeneral('Error sendFeedback', req.body.description, e)
        .then(response => {

        })
        .catch(response => {
          insights.error(response);
          //create user, but Failed sending email.
          console.log('Fail sending email');
        })

      res.status(500).send(e)
    }

  })();
}

function sendGeneralFeedback(req, res) {

  (async () => {
    try {
      let generalfeedback = new Generalfeedback()
      generalfeedback.myuuid = req.body.myuuid
      generalfeedback.pregunta1 = req.body.value.pregunta1
      generalfeedback.pregunta2 = req.body.value.pregunta2
      generalfeedback.moreFunct = req.body.value.moreFunct
      generalfeedback.freeText = req.body.value.freeText
      generalfeedback.save((err, generalfeedbackStored) => {
      })
      serviceEmail.sendMailGeneralFeedback(req.body.value, req.body.myuuid)
        .then(response => {

        })
        .catch(response => {
          insights.error(response);
          //create user, but Failed sending email.
          console.log('Fail sending email');
        })

      res.status(200).send({ send: true })
    } catch (e) {
      insights.error(e);
      console.error("Error sendGeneralFeedback: " + e)
      serviceEmail.sendMailErrorGeneral('Error sendGeneralFeedback', req.body, e)
        .then(response => {

        })
        .catch(response => {
          insights.error(response);
          //create user, but Failed sending email.
          console.log('Fail sending email');
        })

      res.status(500).send(e)
    }

  })();
}

function sendCenter(req, res) {
  try {
    let center = new Center()
    center.myuuid = req.body.myuuid
    center.centro = req.body.centro
    center.save((err, centerStored) => {
    })

    res.status(200).send({ send: true })
  } catch (e) {
    insights.error(e);
    console.error("[ERROR] Send center responded with status: " + e)
    serviceEmail.sendMailErrorGeneral('Error sendCenter', req.body, e)
      .then(response => {

      })
      .catch(response => {
        insights.error(response);
        //create user, but Failed sending email.
        console.log('Fail sending email');
      })

    res.status(500).send(e)
  }
}

function sendNames(req, res) {

  (async () => {
    try {
      let top = new Top()
      top.data = req.body.names
      top.myuuid = req.body.myuuid
      top.save((err, topStored) => {
        res.status(200).send({ send: true })
      })

    } catch (e) {
      insights.error(e);
      console.error("Error sendNames: " + e)
      serviceEmail.sendMailErrorGeneral('Error sendNames', req.body.value, e)
        .then(response => {

        })
        .catch(response => {
          insights.error(response);
          //create user, but Failed sending email.
          console.log('Fail sending email');
        })

      res.status(500).send(e)
    }

  })();
}

module.exports = {
  callOpenAi,
  callOpenAiQuestions,
  callOpenAiAnonymized,
  opinion,
  sendFeedback,
  sendGeneralFeedback,
  sendCenter,
  sendNames
}
