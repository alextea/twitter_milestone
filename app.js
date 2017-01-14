var express = require('express');
var bodyParser = require('body-parser');
var logger = require('express-logger');
var twitterAPI = require('twitter');
var nunjucks = require('nunjucks');
var moment = require('moment');
var sass = require('node-sass-middleware');
var path = require('path');

var app = express();

// Set up App
nunjucks.configure(__dirname + '/views/', {
  autoescape: true,
  express: app,
  noCache: true,
  watch: true
});

app.set('view engine', 'nunjucks');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var srcPath = __dirname + '/sass';
var destPath = __dirname + '/public/css';

// adding the sass middleware
app.use(
  sass({
    src: srcPath,
    dest: destPath,
    prefix: '/css'
  })
);

// The static middleware must come after the sass middleware
app.use(express.static( path.join( __dirname, 'public' ) ) );

var env = process.env.NODE_ENV || 'development'

if (env == 'production') {
  var consumer_key = process.env.CONSUMER_KEY,
      consumer_secret = process.env.CONSUMER_SECRET,
      bearer_token = process.env.BEARER_TOKEN;
} else {
  var secret = require("./secret.json");

  var consumer_key = secret.twitter.consumerKey,
      consumer_secret = secret.twitter.consumerSecret,
      bearer_token = secret.twitter.bearerToken;
}

var twitter = new twitterAPI({
    consumer_key:    consumer_key,
    consumer_secret: consumer_secret,
    bearer_token:    bearer_token
});

app.get("/", function(req, res) {
  res.render('index.html');
});

app.get('/info(/:username)?', function(req, res) {
  if (req.params.username == undefined) {
    if (req.query.username != undefined) {
      res.redirect('/info/'+req.query.username);
      return;
    } else {
      // error page
      var error = "You need to specify a username";
      res.render('error.html', { error: error });
      return;
    }
  }

  var params = { screen_name: req.params.username };

  twitter.get('users/show', params, function(error, user, response) {
    if (!error) {
      var now = moment();
      var created_at = user.created_at.split(" ");
      var date_created = moment(created_at[2]+" "+created_at[1]+" "+created_at[5], "DD MMM YYYY");

      var age = getDateDifference(now, date_created);
      var ageDays = now.diff(date_created, 'days');
      var ageYears = now.diff(date_created, 'years');
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
        ageYears: ageYears,
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
      res.render('error.html', { error: error[0].message });
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

var nunjucksEnv = new nunjucks.Environment();

nunjucksEnv.addFilter('formatNumber', function(n) {
  return n.toLocaleString();
});

nunjucksEnv.addFilter('formatOrdinal', function(n) {
  var ord = "";
  if (n == 1) {
    ord = "st";
  } else if (n == 2) {
    ord = "nd";
  } else if (n == 3) {
    ord = "rd";
  } else {
    ord = "th";
  }

  return n+ord;
});

nunjucksEnv.express(app);

var port = process.env.PORT || 8080;

app.listen(port, function() {
  console.log('App running on port '+port);
  console.log('srcPath is: '+srcPath);
  console.log('destPath is: '+destPath);
});
