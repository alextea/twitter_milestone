var express = require('express');
var bodyParser = require('body-parser');
var logger = require('express-logger');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var inspect = require('util-inspect');
var twitterAPI = require('node-twitter-api');
var nunjucks = require('nunjucks');

var app = express();

// Set up App
nunjucks.configure(__dirname + '/views/', {
  autoescape: true,
  express: app,
  noCache: true,
  watch: true
})

// Set views engine
app.set('view engine', 'nunjucks')

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(logger({ path: "log/express.log"}));
app.use(cookieParser());
app.use(session({ secret: Math.round(Math.random() * 100000).toString(), resave: false, saveUninitialized: true}));

app.use(function(req, res, next) {
  res.locals.session = req.session;
  next();
});

var secret = require("./secret.json");

var twitter = new twitterAPI({
    consumerKey:    secret.twitter.consumerKey,
    consumerSecret: secret.twitter.consumerSecret,
    callback: 'http://localhost:8000/response'
});

var _requestSecret;

app.get("/", function(req, res) {
  res.render('index.html');
});

app.get("/request-token", function(req, res) {
  twitter.getRequestToken(function(err, requestToken, requestSecret) {
    if (err)
    res.status(500).send(err);
    else {
      _requestSecret = requestSecret;
      res.redirect(twitter.getAuthUrl(requestToken));
    }
  });
});

app.get('/response', function(req, res){
  var requestToken = req.query.oauth_token,
  verifier = req.query.oauth_verifier;

  twitter.getAccessToken(requestToken, _requestSecret, verifier, function(err, accessToken, accessSecret) {
    if (err)
    res.status(500).send(err);
    else
    twitter.verifyCredentials(accessToken, accessSecret, function(err, user) {
      if (err)
      res.status(500).send(err);
      else
      req.session.user = user;
      res.redirect('/info');
    });
  });
});

app.get('/info', function(req, res){
  res.render('info.html', { user: req.session.user });
});

app.listen(8000, function() {
  console.log('App running on port 8000!');
});
