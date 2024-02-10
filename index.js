const express = require('express');
const csrf = require('csurf');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const { User, games } = require('./models');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const passport = require('passport');
const session = require('express-session');
const LocalStrategy = require('passport-local').Strategy;

const app = express();
const cookieParser = require('cookie-parser');

app.use(cookieParser('shh! some secret string'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(__dirname + '/public'));

const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

app.use(
    session({
        secret: 'my-super-secret-key-21728172615261562',
        cookie: {
            maxAge: 24 * 60 * 60 * 1000, // 24hrs
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({ usernameField: 'email', passwordField: 'password' },
    async (username, password, done) => {
        try {
            const user = await User.findOne({ where: { email: username } });
            if (!user) {
                return done(null, false);
            }
            const result = await bcrypt.compare(password, user.password);
            if (result) {
                return done(null, user);
            } else {
                return done(null, false, { message: 'Invalid Password' });
            }
        } catch (error) {
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('signup', { title: 'signup', csrfToken: req.csrfToken() });
});

async function createUser(username, email, password, confirmPassword) {
    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
        throw new Error('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    return User.create({
        username,
        email,
        password: hashedPassword,
        confirmPassword,
    });
}

app.post('/users', async (req, res) => {
    try {
        await createUser(
            req.body.username,
            req.body.email,
            req.body.password,
            req.body.confirmPassword
        );

        res.redirect('/login');
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message || 'Invalid request' });
    }
});

app.post('/games', async (req, res) => {
    try {
        const game = await games.create({
            title: req.body.title,
            subtitle: req.body.subtitle,
            date: req.body.date,
            userId: req.user.id,
        });

        res.redirect('/games');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.get('/games', async (request, response) => {
    try {
        const allgames = await games.getgames();

        if (request.accepts('html')) {
            response.render('index', {
                allgames,
                today: new Date().toLocaleDateString(),
                csrfToken: request.csrfToken(),
            });
        } else {
            response.json(allgames);
        }
    } catch (error) {
        console.error(error);
        response.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/login', (req, res) => {
    res.render('login', { title: "Login", csrfToken: req.csrfToken() });
});

app.post('/session', passport.authenticate('local', { failureRedirect: "/login" }), (req, res) => {
    res.redirect('/games');
});

app.get('/signout',(req, res, next)=>{
    req.logout((error)=>{
    if(error){return next(error)};
    res.redirect('/')
    })
})

app.delete('/games/:id', csrfProtection, async (request, response) => {
    const gameId = request.params.id;

    try {
        await games.deleteGameById(gameId);
        response.sendStatus(200);
    } catch (error) {
        console.error(error);
        response.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(3000, () => {
    console.log('Express server started at port 3000');
});



