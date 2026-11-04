// Egyszeri JS bundle fordítás a gulpfile webpack konfigurációjával,
// a `gulp javascript` belső függvénye nem érhető el külön taskként.
const path = require('node:path')
const webpack = require('webpack')

const ROOT = path.resolve(__dirname, '..')

webpack(
    {
        mode: 'development',
        context: ROOT,
        entry: path.join(ROOT, 'src/assets/js/app.js'),
        output: {
            path: path.join(ROOT, 'dist/assets/js'),
            filename: 'app.js',
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env'],
                            compact: false,
                        },
                    },
                },
            ],
        },
        devtool: 'source-map',
    },
    (error, stats) => {
        if (error) {
            console.error(error)
            process.exit(1)
        }
        console.log(stats.toString({ colors: false, chunks: false }))
        if (stats.hasErrors()) process.exit(1)
    }
)
