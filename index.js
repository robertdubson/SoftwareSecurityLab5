const uuid = require('uuid');
const onFinished = require('on-finished');
const bodyParser = require('body-parser');
const path = require('path');
const port = 3000;
const fs = require('fs');
require('dotenv').config();
const express = require('express');
const app = express();
const { auth, requiredScopes } = require('express-oauth2-jwt-bearer');
const jwt = require('jsonwebtoken')
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
var axios = require("axios").default;
const SESSION_KEY = 'Authorization';


  
const checkScopes = requiredScopes('read:roles');

class Session {
    #sessions = {}

    constructor() {
        try {
            this.#sessions = fs.readFileSync('./sessions.json', 'utf8');
            this.#sessions = JSON.parse(this.#sessions.trim());

            console.log(this.#sessions);
        } catch (e) {
            this.#sessions = {};
        }
    }

    #storeSessions() {
        fs.writeFileSync('./sessions.json', JSON.stringify(this.#sessions), 'utf-8');
    }

    set(key, value) {
        if (!value) {
            value = {};
        }
        this.#sessions[key] = value;
        this.#storeSessions();
    }

    get(key) {
        return this.#sessions[key];
    }

    init(res) {
        const sessionId = uuid.v4();
        this.set(sessionId);

        return sessionId;
    }

    destroy(req, res) {
        const sessionId = req.sessionId;
        delete this.#sessions[sessionId];
        this.#storeSessions();
    }
}

app.get('/api/public', (req, res) => {
    res.json({
      message: 'This is public endpoint!'
    });
  });

const checkJwt = auth({
    audience: 'https://dev-v6dn22odsnvfctjt.us.auth0.com/api/v2/',
    issuerBaseURL: `https://dev-v6dn22odsnvfctjt.us.auth0.com/`,
});

app.get('/api/private', checkJwt, (req, res) =>{
    res.json({
          message: 'You are authenticated'
      })
  });



app.get('/api/private-scoped', checkJwt, checkScopes, (req, res) => {
  res.json({
    message: 'Hello from a private endpoint! You need to be authenticated and have a scope of read:roles to see this.'
  });
});



const sessions = new Session();

app.use((req, res, next) => {
    let currentSession = {};
    let sessionId = req.get(SESSION_KEY);

    if (sessionId) {
        currentSession = sessions.get(sessionId);
        if (!currentSession) {
            currentSession = {};
            sessionId = sessions.init(res);
        }
    } else {
        sessionId = sessions.init(res);
    }

    req.session = currentSession;
    req.sessionId = sessionId;
    onFinished(req, () => {
        const currentSession = req.session;
        const sessionId = req.sessionId;
        sessions.set(sessionId, currentSession);
    });



    next();
});

app.get('/', (req, res) => {
    if (req.session.username) {
        return res.json({
            username: req.session.username,
            logout: 'http://localhost:3000/logout'
        })
    }
    res.sendFile(path.join(__dirname + '/index.html'));
})

app.get('/logout', (req, res) => {
    sessions.destroy(req, res);
    res.redirect('/');
});

const users = [
    {
        login: 'Login',
        password: 'Password',
        username: 'Username',
    },
    {
        login: 'Login1',
        password: 'Password1',
        username: 'Username1',
    }
]

app.post('/api/newuser', (req, res) => {

    const { email, givenname, familyname, nickname, user_id, password } = req.body;

    const { json } = require("body-parser")
    var request = require("request");

    var client_token = "";

    var optionsreadtoken = {
        method: 'POST',
        url: 'https://kpi.eu.auth0.com/oauth/token',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        form: {
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            audience: process.env.AUDIENCE,
            grant_type: "client_credentials"
        }
    };

    request(optionsreadtoken, function (error, response, body) {
        if (error) throw new Error(error);
        client_token = JSON.parse(body)['access_token']
        console.log(body);
        var options = {
            method: 'POST',
            url: 'https://kpi.eu.auth0.com/api/v2/users',
            headers: {
                'content-type': 'application/json',
                'Authorization': "Bearer " + client_token
            },
            body: JSON.stringify({
                "email": email,
                "user_metadata": {},
                "blocked": false,
                "email_verified": false,
                "app_metadata": {},
                "given_name": givenname,
                "family_name": familyname,
                "name": "Robert Dubson",
                "nickname": nickname,
                "picture": "https://uk.wikipedia.org/wiki/%D0%9A%D0%B0%D1%86%D1%83%D1%80%D0%B0%D2%91%D1%96_%D0%9C%D1%96%D1%81%D0%B0%D1%82%D0%BE#/media/%D0%A4%D0%B0%D0%B9%D0%BB:Katsuragi-misato.jpg",
                "user_id": user_id,
                "connection": "Username-Password-Authentication",
                "password": password,
                "verify_email": false
            })
        };

        request(options, function (error, response, body) {
            console.log("Bearer " + client_token)
            if (error) {
                response.status(response.statusCode).send;
                throw new Error(error); 
            }

            console.log(body);

            res.status(200).send;
            res.end(body)
        });
    });






});

app.post('/api/login', (req, res) => {
    const { login, password } = req.body;

    var request = require("request");

    var options = {
        method: 'POST',
        url: 'https://dev-v6dn22odsnvfctjt.us.auth0.com/oauth/token',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        form:
        {
            grant_type: process.env.GRANT_TYPE,
            username: login,
            password: password,
            audience: process.env.AUDIENCE,
            scope: process.env.SCOPE,
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            realm: process.env.REALM
        }
    };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);

        console.log(body);
        console.log("statusCode: ", response.statusCode);
        console.log("statusCode: ", res.statusCode);
        if (response.statusCode == 200) {
            req.session.login = login;
            res.json({ token: JSON.parse(body)['access_token'] });
        }

        res.status(401).send();
    });


});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
