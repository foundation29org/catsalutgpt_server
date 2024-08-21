// file that contains the routes of the api
'use strict'

const express = require('express')

const langCtrl = require('../controllers/all/lang')
const supportCtrl = require('../controllers/all/support')
const openAIserviceCtrl = require('../services/openaiazure')
const translationCtrl = require('../services/translation')
const cors = require('cors');
const serviceEmail = require('../services/email')
const api = express.Router()
const ipRangeCheck = require('ip-range-check');
const config= require('../config')
const myApiKey = config.Server_Key;
const myallowedRanges = JSON.parse(config.defaultRanges);

// Lista de dominios permitidos
const whitelist = config.allowedOrigins;

  function corsWithOptions(req, res, next) {
    const corsOptions = {
      origin: function (origin, callback) {
        let  ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        if (ip.includes(':')) {
          ip = ip.split(':')[0];
        }

        if (whitelist.includes(origin) || myallowedRanges.some(range => ipRangeCheck(ip, range))) {
          callback(null, true);
        } else {
            // La IP del cliente
            const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const requestInfo = {
                method: req.method,
                url: req.url,
                headers: req.headers,
                origin: origin,
                body: req.body, // Asegúrate de que el middleware para parsear el cuerpo ya haya sido usado
                ip: clientIp,
                params: req.params,
                query: req.query,
              };
            serviceEmail.sendMailControlCall(requestInfo)
            callback(new Error('Not allowed by CORS'));
        }
      },
    };
  
    cors(corsOptions)(req, res, next);
  }

  const checkApiKey = (req, res, next) => {
    // Permitir explícitamente solicitudes de tipo OPTIONS para el "preflight" de CORS
    if (req.method === 'OPTIONS') {
      return next();
    } else {
      const apiKey = req.get('x-api-key');
      if (apiKey && apiKey === myApiKey) {
        return next();
      } else {
        return res.status(401).json({ error: 'API Key no válida o ausente' });
      }
    }
  };

// lang routes, using the controller lang, this controller has methods
api.get('/langs/',  langCtrl.getLangs)

//Support
api.post('/sendmsg/', corsWithOptions, checkApiKey, supportCtrl.sendMsg)

//services OPENAI
api.post('/callopenai', corsWithOptions, checkApiKey, openAIserviceCtrl.callOpenAi)
api.post('/callopenaiquestions', corsWithOptions, checkApiKey, openAIserviceCtrl.callOpenAiQuestions)
api.post('/callanonymized', corsWithOptions, checkApiKey, openAIserviceCtrl.callOpenAiAnonymized)

//services OPENAI
api.post('/opinion', corsWithOptions, checkApiKey, openAIserviceCtrl.opinion)
api.post('/feedback', corsWithOptions, checkApiKey, openAIserviceCtrl.sendFeedback)

api.post('/sendNames', corsWithOptions, checkApiKey, openAIserviceCtrl.sendNames)


api.post('/generalfeedback', corsWithOptions, checkApiKey, openAIserviceCtrl.sendGeneralFeedback)

api.post('/center', corsWithOptions, checkApiKey, openAIserviceCtrl.sendCenter)


api.post('/getDetectLanguage', corsWithOptions, checkApiKey, translationCtrl.getDetectLanguage)
api.post('/translation', corsWithOptions, checkApiKey, translationCtrl.getTranslationDictionary)
api.post('/translationinvert', corsWithOptions, checkApiKey, translationCtrl.getTranslationDictionaryInvert)
api.post('/translation/segments', corsWithOptions, checkApiKey, translationCtrl.getTranslationSegments)

module.exports = api
