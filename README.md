# Divexplore

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 15.0.4.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.


# OpenAPI Integration

run `npm install @openapitools/openapi-generator-cli -g`
(run `npm install -g ng-openapi-gen`)

Next, add the following lines to your `package.json` file:

  "scripts": {
    "gen-dres-client": "openapi-generator-cli generate -g typescript-angular -i https://raw.githubusercontent.com/dres-dev/DRES/master/doc/oas-client.json -o openapi/dres --skip-validate-spec --additional-properties npmName=@dres-client-openapi/api,ngVersion=13.0.0,enumPropertyNaming=original",
    "gen-dres-dev-client": "openapi-generator-cli generate -g typescript-angular -i https://raw.githubusercontent.com/dres-dev/DRES/dev/doc/oas-client.json -o openapi/dres --skip-validate-spec --additional-properties npmName=@dres-client-openapi/api,ngVersion=13.0.0,enumPropertyNaming=original"
  },
  
  "dependencies": {
    "@openapitools/openapi-generator-cli": "2.4.26"
  },
  
Finally, generate the TypeScript files with these commands:
`npm run-script gen-dres-client`
`npm run-script gen-dres-dev-client`

Simply import the generated files like this:
`import {SubmissionService} from '../../openapi/dres/api/submission.service';`
