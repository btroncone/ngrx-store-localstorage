module.exports = function (config) {
    config.set({
        frameworks: ['jasmine', 'karma-typescript'],
        files: [
            {
                pattern: 'src/**/*.ts'
            },
            {
                pattern: 'spec/**/*.ts'
            }
        ],
        plugins: [
            'karma-jasmine',
            'karma-typescript',
            'karma-coverage',
            'karma-chrome-launcher',
            'karma-jasmine-html-reporter',
            'karma-coverage-istanbul-reporter'
        ],
        coverageReporter: {
            instrumenterOptions: {
                istanbul: {
                    noCompact: true
                }
            }
        },
        karmaTypescriptConfig: {
            compilerOptions: {
                module: "commonjs"
            },
            tsconfig: "./spec/tsconfig.json",
        },
        preprocessors: {
            'src/**/*.ts': ['karma-typescript', 'coverage'],
            'spec/**/*.ts': ['karma-typescript']
        },
        reporters: ['progress', 'coverage', 'karma-typescript'], // 'coverage-istanbul'],
        // reporters: ['progress', 'coverage-istanbul'],
        // reporters: ['progress', 'kjhtml'],
        browsers: ['Chrome']
    });
};