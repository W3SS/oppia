// Copyright 2014 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Directive for the PencilCodeEditor interaction.
 *
 * IMPORTANT NOTE: The naming convention for customization args that are passed
 * into the directive is: the name of the parameter, followed by 'With',
 * followed by the name of the arg.
 */

oppia.directive('oppiaInteractivePencilCodeEditor', [
  'HtmlEscaperService', 'UrlInterpolationService',
  function(HtmlEscaperService, UrlInterpolationService) {
    return {
      restrict: 'E',
      scope: {
        onSubmit: '&'
      },
      templateUrl: UrlInterpolationService.getExtensionResourceUrl(
        '/interactions/PencilCodeEditor/directives/' +
        'pencil_code_editor_interaction_directive.html'),
      controller: [
        '$scope', '$attrs', '$element', '$timeout', '$modal',
        'FocusManagerService', 'pencilCodeEditorRulesService',
        function($scope, $attrs, $element, $timeout, $modal,
          FocusManagerService, pencilCodeEditorRulesService) {
          $scope.initialCode = HtmlEscaperService.escapedJsonToObj(
            $attrs.initialCodeWithValue);
          var iframeDiv = $element.find('.pencil-code-editor-iframe').get(0);
          var pce = new PencilCodeEmbed(iframeDiv);
          pce.beginLoad($scope.initialCode);
          pce.on('load', function() {
            // Hides the error console at the bottom right, and prevents it
            // from showing up even if the code has an error. Also, hides the
            // turtle, and redefines say() to also write the text on the
            // screen.
            pce.setupScript([{
              code: [
                'debug.hide();',
                'window.removeEventListener("error", debug)',
                '',
                'ht();',
                '',
                'oldsay = window.say',
                'say = function(x) {',
                '  write(x);',
                '  oldsay(x);',
                '};'
              ].join('\n'),
              type: 'text/javascript'
            }]);

            pce.hideToggleButton();
            pce.setEditable();
            pce.showEditor();

            // Pencil Code automatically takes the focus on load, so we clear
            // it.
            FocusManagerService.clearFocus();
          });

          $scope.reset = function() {
            $modal.open({
              templateUrl: UrlInterpolationService.getExtensionResourceUrl(
                '/interactions/PencilCodeEditor/directives/' +
                'pencil_code_reset_confirmation_directive.html'),
              backdrop: 'static',
              keyboard: false,
              controller: [
                '$scope', '$modalInstance', function($scope, $modalInstance) {
                  $scope.cancel = function() {
                    $modalInstance.dismiss();
                  };

                  $scope.resetCode = function() {
                    $modalInstance.close();
                  };
                }]
            }).result.then(function() {
              pce.setCode($scope.initialCode);
            });
          };

          var getNormalizedCode = function() {
            // Converts tabs to spaces.
            return pce.getCode().replace(/\t/g, '  ');
          };

          var errorIsHappening = false;
          var hasSubmittedAnswer = false;

          pce.on('startExecute', function() {
            hasSubmittedAnswer = false;
          });

          pce.on('execute', function() {
            if (errorIsHappening || hasSubmittedAnswer) {
              return;
            }

            pce.eval('document.body.innerHTML', function(pencilCodeHtml) {
              var normalizedCode = getNormalizedCode();

              // Get all the divs, and extract their textual content.
              var output = $.map(
                $(pencilCodeHtml).filter('div'), function(elem) {
                  return $(elem).text();
                }).join('\n');

              console.log('Code (normalized): ');
              console.log(normalizedCode);
              console.log('Output: ');
              console.log(output);
              console.log('------');

              hasSubmittedAnswer = true;
              $scope.onSubmit({
                answer: {
                  code: normalizedCode,
                  output: output || '',
                  evaluation: '',
                  error: ''
                },
                rulesService: pencilCodeEditorRulesService
              });
            }, true);
          });

          pce.on('error', function(error) {
            if (hasSubmittedAnswer) {
              return;
            }

            var normalizedCode = getNormalizedCode();

            console.log('Code: ');
            console.log(normalizedCode);
            console.log('Error: ');
            console.log(error.message);
            console.log('------');

            errorIsHappening = true;
            hasSubmittedAnswer = true;

            $scope.$parent.submitAnswer({
              code: normalizedCode,
              output: '',
              evaluation: '',
              error: error.message
            }, pencilCodeEditorRulesService);

            $timeout(function() {
              errorIsHappening = false;
            }, 1000);
          });
        }]
    };
  }
]);

oppia.directive('oppiaResponsePencilCodeEditor', [
  'HtmlEscaperService', 'UrlInterpolationService',
  function(HtmlEscaperService, UrlInterpolationService) {
    return {
      restrict: 'E',
      scope: {},
      templateUrl: UrlInterpolationService.getExtensionResourceUrl(
        '/interactions/PencilCodeEditor/directives/' +
        'pencil_code_editor_response_directive.html'),
      controller: ['$scope', '$attrs', function($scope, $attrs) {
        $scope.answerCode = HtmlEscaperService.escapedJsonToObj(
          $attrs.answer).code;
      }]
    };
  }
]);

oppia.directive('oppiaShortResponsePencilCodeEditor', [
  'HtmlEscaperService', 'UrlInterpolationService',
  function(HtmlEscaperService, UrlInterpolationService) {
    return {
      restrict: 'E',
      scope: {},
      templateUrl: UrlInterpolationService.getExtensionResourceUrl(
        '/interactions/PencilCodeEditor/directives/' +
        'pencil_code_editor_short_response_directive.html'),
      controller: ['$scope', '$attrs', function($scope, $attrs) {
        $scope.answerCode = HtmlEscaperService.escapedJsonToObj(
          $attrs.answer).code;
      }]
    };
  }
]);

oppia.factory('pencilCodeEditorRulesService', [
  '$filter', 'CodeNormalizerService',
  function($filter, CodeNormalizerService) {
    return {
      CodeEquals: function(answer, inputs) {
        var normalizedCode =
          CodeNormalizerService.getNormalizedCode(answer.code);
        var normalizedExpectedCode =
          CodeNormalizerService.getNormalizedCode(inputs.x);
        return normalizedCode === normalizedExpectedCode;
      },
      CodeContains: function(answer, inputs) {
        var normalizedCode =
          CodeNormalizerService.getNormalizedCode(answer.code);
        var normalizedSnippet =
          CodeNormalizerService.getNormalizedCode(inputs.x);
        return normalizedCode.indexOf(normalizedSnippet) !== -1;
      },
      CodeDoesNotContain: function(answer, inputs) {
        var normalizedCode =
          CodeNormalizerService.getNormalizedCode(answer.code);
        var normalizedSnippet =
          CodeNormalizerService.getNormalizedCode(inputs.x);
        return normalizedCode.indexOf(normalizedSnippet) === -1;
      },
      OutputEquals: function(answer, inputs) {
        var normalizedOutput = $filter('normalizeWhitespace')(answer.output);
        var normalizedExpectedOutput =
          $filter('normalizeWhitespace')(inputs.x);
        return normalizedOutput === normalizedExpectedOutput;
      },
      OutputRoughlyEquals: function(answer, inputs) {
        var normalizedOutput = $filter(
          'normalizeWhitespacePunctuationAndCase')(answer.output);
        var normalizedExpectedOutput =
          $filter('normalizeWhitespacePunctuationAndCase')(inputs.x);
        return normalizedOutput === normalizedExpectedOutput;
      },
      ResultsInError: function(answer) {
        return !!(answer.error.trim());
      },
      ErrorContains: function(answer, inputs) {
        var normalizedError = $filter('normalizeWhitespace')(answer.error);
        var normalizedSnippet = $filter('normalizeWhitespace')(inputs.x);
        return normalizedError.indexOf(normalizedSnippet) !== -1;
      }
    };
  }]);
