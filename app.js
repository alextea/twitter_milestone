var express = require('express');
var bodyParser = require('body-parser');
var logger = require('express-logger');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var inspect = require('util-inspect');
var twitterAPI = require('twitter');
var nunjucks = require('nunjucks');
var moment = require('moment');

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
    consumer_key:    secret.twitter.consumerKey,
    consumer_secret: secret.twitter.consumerSecret,
    bearer_token:    secret.twitter.bearerToken,
    callback: 'http://localhost:8000/response'
});

var _requestSecret;

app.get("/", function(req, res) {
  if (req.session.user != undefined) {
    res.redirect('/info');
  } else {
    res.render('index.html');
  }
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
    if (err) {
      res.status(500).send(err);
    } else {
      twitter.verifyCredentials(accessToken, accessSecret, function(err, user) {
        if (err) {
          res.status(500).send(err);
        } else {
          req.session.user = user;
          res.redirect('/info');
        }
      });
    }
  });
});

app.get('/info(/:username)?', function(req, res) {
  if (req.params.username == undefined) {
    if (req.query.username != undefined) {
      res.redirect('/info/'+req.query.username);
    } else {
      // error page
    }
  }

  var params = { screen_name: req.params.username };

  twitter.get('users/show', params, function(error, user, response) {
    if (!error) {
      // console.log(user);

      var now = moment();
      var created_at = user.created_at.split(" ");
      var date_created = moment(created_at[2]+" "+created_at[1]+" "+created_at[5], "DD MMM YYYY");

      var age = getDateDifference(now, date_created);
      var ageDays = now.diff(date_created, 'days');
      var nextAnniversary = getNextOccurance(date_created);
      var nextAnniversaryString = getDateDifference(now, nextAnniversary);
      var anniversaryDays = Math.abs(now.diff(nextAnniversary, 'days'));

      var tweetCount = user.statuses_count;
      var averageTweets = (tweetCount / ageDays).toFixed(2);

      var nextMilestone = getNextMilestone(tweetCount);
      var tweetDifference = nextMilestone - tweetCount;
      var tweetTimes = Math.ceil(tweetDifference / anniversaryDays);

      var data = {
        user: user,
        age: age,
        nextAnniversary: nextAnniversaryString,
        tweetCount: tweetCount,
        averageTweets: averageTweets,
        nextMilestone: nextMilestone,
        tweetDifference: tweetDifference,
        tweetTimes: tweetTimes
      }

      res.render('info.html', data);
    } else {
      // console.log(error);
      // console.log(response);
    }
  });
});

var getNextOccurance = function(date) {
  var now = moment();
  var input = moment(date);
  var output = moment(input).year(now.year());

  if (input.month() < now.month()) {
    // next year
    output.year(now.year() + 1);
  } else if (input.month() > now.month()) {
    // do nothing
  } else if (input.month() == now.month()) {
    if (input.day() < now.day()) {
      // next year
      output.year(now.year() + 1);
    } else if (input.day() >= now.day()) {
      // do nothing
    }
  }
  return output;
}

var getDateDifference = function(date1, date2) {
  var date1 = moment(date1), date2 = moment(date2);

  var years = date1.diff(date2, 'year');
  date2.add(years, 'years');

  var months = date1.diff(date2, 'months');
  date2.add(months, 'months');

  var days = date1.diff(date2, 'days');

  years = Math.abs(years);
  months = Math.abs(months);
  days = Math.abs(days);

  var string = "";
  if (years > 0) {
    string += years + ' year';
    if (years > 1) {
      string += 's';
    }
  }

  if (months > 0) {
    if (years > 0) {
      if (days > 0) {
        string += ', ';
      } else {
        string += ' and ';
      }
    }
    string += months + ' month';
    if (months > 1) {
      string += 's';
    }
  }

  if (days > 0) {
    if (years > 0 || months > 0) {
      string += ' and ';
    }
    string += days + ' day';
    if (days > 1) {
      string += 's';
    }
  }

  return string;
}

var getNextMilestone = function(n, y=0) {
  var x = String(n).length;
  if (y==0) {
    var y = "1";
    while (y.length < x) {
      y += "0";
    }
  }

  z = Math.ceil(n/y) * y;

  return z;
}

app.listen(8000, function() {
  console.log('App running on port 8000!');
});
