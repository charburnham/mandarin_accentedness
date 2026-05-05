// Initialize jsPsych
const jsPsych = initJsPsych({
  show_progress_bar: true,
  on_finish: function() {
    //jsPsych.data.displayData();
    window.location.href = 'finish.html';
  }
});

const subject_id = jsPsych.randomization.randomID(10);
const DATAPIPE_EXPERIMENT_ID = "khJ8Nh63lw9p";
const datapipeConfigured = DATAPIPE_EXPERIMENT_ID.trim() !== "";
const data_filename = `${subject_id}_data.csv`;
const timeline = [];

jsPsych.data.addProperties({
  subject_id: subject_id
});

const uiLabels = {
  continue: "Continue / 继续",
  next: "Next / 下一步",
  startRecording: "Start Recording / 开始录音",
  finishRecording: "Finish Recording / 完成录音",
  rerecord: "Re-record / 重新录音",
  continueToNextSentence: "Continue to Next Sentence / 继续下一句",
  yes: "Yes / 是",
  no: "No / 否",
  back: "Back / 返回"
};

function renderParagraphs(paragraphs = []) {
  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
}

function renderList(items = []) {
  if (items.length === 0) {
    return "";
  }

  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function languageBlock({ label, title, paragraphs = [], listItems = [], headingLevel = 2, extraHtml = "" }) {
  return `
    <section class="language-block">
      <div class="language-label">${label}</div>
      <h${headingLevel}>${title}</h${headingLevel}>
      ${renderParagraphs(paragraphs)}
      ${renderList(listItems)}
      ${extraHtml}
    </section>
  `;
}

function sentenceTrialScreen({ englishTitle, englishParagraphs, chineseTitle, chineseParagraphs, sentence, panelNote = "", extraPanelContent = "" }) {
  return `
    <div class="recording-screen-stack">
      <div class="recording-instructions-box">
        ${languageBlock({
          label: "English",
          title: englishTitle,
          paragraphs: englishParagraphs
        })}
        ${languageBlock({
          label: "中文",
          title: chineseTitle,
          paragraphs: chineseParagraphs
        })}
      </div>
      <div class="sentence-panel">
        <div class="sentence-panel-label">Sentence / 句子</div>
        <p class="sentence-stimulus">${sentence}</p>
        ${panelNote ? `<p class="sentence-panel-note">${panelNote}</p>` : ""}
        ${extraPanelContent}
      </div>
    </div>
  `;
}

function queueAudioUpload(data, filename) {
  if (!datapipeConfigured) {
    console.warn("DataPipe experiment ID is not configured. Audio upload was skipped.");
    data.response = filename;
    data.audio_upload = "skipped_missing_datapipe_id";
    return;
  }

  jsPsychPipe.saveBase64Data(DATAPIPE_EXPERIMENT_ID, filename, data.response);
  data.response = filename;
  data.audio_upload = "queued";
}

function buildSentenceTrial(trial_obj) {
  let latestRecording = null;
  let attemptNumber = 0;

  return {
    timeline: [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus: sentenceTrialScreen({
          englishTitle: "Read the sentence aloud",
          englishParagraphs: [
            "Take a moment to get ready. When you are ready to begin, click the button below to start recording."
          ],
          chineseTitle: "请大声朗读这句话",
          chineseParagraphs: [
            "请先准备好。准备开始时，请点击下面的按钮开始录音。"
          ],
          sentence: trial_obj.stimulus,
          panelNote: "Press Start Recording / 开始录音 when you are ready."
        }),
        choices: [uiLabels.startRecording],
        data: {
          stimulus_code: trial_obj.code,
          sentence: trial_obj.stimulus,
          condition: trial_obj.condition,
          trial_stage: 'sentence_ready'
        }
      },
      {
        type: jsPsychHtmlAudioResponse,
        stimulus: sentenceTrialScreen({
          englishTitle: "Recording in progress",
          englishParagraphs: [
            "Please read the sentence naturally, then click the button when you are done."
          ],
          chineseTitle: "正在录音",
          chineseParagraphs: [
            "请自然地朗读这句话，读完后点击按钮。"
          ],
          sentence: trial_obj.stimulus,
          panelNote: "Press Finish Recording / 完成录音 after you finish reading."
        }),
        recording_duration: 15000,
        show_done_button: true,
        allow_playback: false,
        save_audio_url: true,
        done_button_label: uiLabels.finishRecording,
        data: {
          stimulus_code: trial_obj.code,
          sentence: trial_obj.stimulus,
          condition: trial_obj.condition,
          trial_stage: 'sentence_recording'
        },
        on_finish: function(data) {
          attemptNumber += 1;
          latestRecording = {
            response: data.response,
            audio_url: data.audio_url,
            filename: `${subject_id}_${trial_obj.code}_audio.webm`
          };

          data.recording_attempt = attemptNumber;
          data.recording_filename = latestRecording.filename;
          data.response = null;
        }
      },
      {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
          return sentenceTrialScreen({
            englishTitle: "Review your recording",
            englishParagraphs: [
              "Listen to your recording for this sentence. If you want, you can record it again before moving on."
            ],
            chineseTitle: "检查你的录音",
            chineseParagraphs: [
              "请听一下这句话的录音。如果你愿意，可以在继续之前重新录音。"
            ],
            sentence: trial_obj.stimulus,
            panelNote: "Choose Re-record / 重新录音 or Continue to Next Sentence / 继续下一句 below.",
            extraPanelContent: `<audio controls src="${latestRecording.audio_url}" class="playback-audio"></audio>`
          });
        },
        choices: [uiLabels.rerecord, uiLabels.continueToNextSentence],
        data: {
          stimulus_code: trial_obj.code,
          sentence: trial_obj.stimulus,
          condition: trial_obj.condition,
          trial_stage: 'sentence_review'
        },
        on_finish: function(data) {
          data.recording_attempt = attemptNumber;
          data.recording_filename = latestRecording.filename;
          data.review_decision = data.response === 0 ? 'rerecord' : 'accepted';

          if (data.response === 1) {
            const uploadRecord = {
              response: latestRecording.response,
              audio_upload: null
            };
            queueAudioUpload(uploadRecord, latestRecording.filename);
            data.audio_upload = uploadRecord.audio_upload;
            data.saved_audio_file = latestRecording.filename;
          } else {
            data.audio_upload = "not_uploaded_rerecorded";
            data.saved_audio_file = null;
          }

          if (latestRecording.audio_url) {
            URL.revokeObjectURL(latestRecording.audio_url);
          }

          latestRecording = null;
        }
      }
    ],
    loop_function: function() {
      const lastReview = jsPsych.data.get().filter({
        stimulus_code: trial_obj.code,
        trial_stage: 'sentence_review'
      }).last(1).values()[0];

      return lastReview.response === 0;
    }
  };
}

// 1. Consent Form
const consent = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="consent">
      ${languageBlock({
        label: "English",
        title: "Consent Form",
        paragraphs: [
          'If you agree to participate in this research, please click "Continue / 继续".'
        ]
      })}
      ${languageBlock({
        label: "中文",
        title: "知情同意书",
        paragraphs: [
          "如果你同意参加这项研究，请点击“Continue / 继续”。"
        ]
      })}
    </div>
  `,
  choices: [uiLabels.continue]
};
timeline.push(consent);

// 2. Instructions
const instructions = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="instructions">
      ${languageBlock({
        label: "English",
        title: "Instructions",
        paragraphs: [
          "In this experiment, you will see a sentence on the screen.",
          "Your task is to record yourself reading that sentence aloud using your microphone.",
          `For each sentence, you'll click <strong>${uiLabels.startRecording}</strong> when you're ready, rather than having the recording begin right away.`,
          "After each recording, you can listen back and either continue to the next sentence or re-record.",
          `Click "${uiLabels.next}" to continue to the microphone test.`
        ]
      })}
      ${languageBlock({
        label: "中文",
        title: "说明",
        paragraphs: [
          "在这个实验中，你会在屏幕上看到一句话。",
          "你的任务是使用麦克风录下自己大声朗读这句话的声音。",
          `对于每一句话，请在你准备好后点击<strong>${uiLabels.startRecording}</strong>，录音不会自动开始。`,
          "每次录音后，你都可以回放录音，并选择继续下一句或重新录音。",
          `点击“${uiLabels.next}”继续进行麦克风测试。`
        ]
      })}
    </div>
  `,
  choices: [uiLabels.next]
};
timeline.push(instructions);

const checklist = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <div class="content">
      ${languageBlock({
        label: "English",
        title: "Quick Checklist Before You Begin"
      })}
      ${languageBlock({
        label: "中文",
        title: "开始前快速检查"
      })}
      <div class="tip-box">
        ${languageBlock({
          label: "English",
          title: '<img src="https://www.google.com/chrome/static/images/chrome-logo.svg" style="height: 1em; vertical-align: middle; margin-right: 0.3em;"> Chrome Browser required',
          headingLevel: 3,
          paragraphs: [
            "<strong>To ensure the experiment runs smoothly, please use the Google Chrome browser.</strong>"
          ]
        })}
        ${languageBlock({
          label: "中文",
          title: "需要使用 Chrome 浏览器",
          headingLevel: 3,
          paragraphs: [
            "<strong>为确保实验顺利进行，请使用 Google Chrome 浏览器。</strong>"
          ]
        })}
      </div>
      <div class="tip-box">
        ${languageBlock({
          label: "English",
          title: "Microphone is required",
          headingLevel: 3,
          paragraphs: [
            "<strong>Please make sure you can use a microphone and allow microphone access when prompted by your browser.</strong>"
          ]
        })}
        ${languageBlock({
          label: "中文",
          title: "需要使用麦克风",
          headingLevel: 3,
          paragraphs: [
            "<strong>请确认你可以使用麦克风，并在浏览器提示时允许麦克风访问。</strong>"
          ]
        })}
        
        <div class="mic-confirm-box">
          ${languageBlock({
            label: "English",
            title: "Microphone Check",
            headingLevel: 3,
            paragraphs: [
              "<strong>Are you able to use a microphone to record your voice during this experiment?</strong>"
            ]
          })}
          ${languageBlock({
            label: "中文",
            title: "麦克风确认",
            headingLevel: 3,
            paragraphs: [
              "<strong>在这个实验中，你能够使用麦克风录下自己的声音吗？</strong>"
            ]
          })}
          <label><input type="radio" name="mic_confirm" value="yes"> ${uiLabels.yes}</label><br>
          <label><input type="radio" name="mic_confirm" value="no"> ${uiLabels.no}</label>
        </div>
      </div>

      <p class="mic-warning" style="color: red; display: none; margin-top: 10px;">
        Unfortunately, you cannot participate in this study without a working microphone.<br>
        很遗憾，如果没有可用的麦克风，你将无法参加这项研究。
      </p>
      <button id="custom-next" class="jspsych-btn">${uiLabels.next}</button>
    </div>
  `,
  choices: "NO_KEYS",
  on_load: function () {
    document.getElementById('custom-next').addEventListener('click', function () {
      const selected = document.querySelector('input[name="mic_confirm"]:checked');
      if (selected && selected.value === "yes") {
        jsPsych.finishTrial({ microphone_confirmed: "yes" });
      } else {
        document.querySelector('.mic-warning').style.display = 'block';
      }
    });
  }
};
timeline.push(checklist);

// Microphone setup instruction
const micSetupInstruction = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="content">
      <div class="instruction-box">
        ${languageBlock({
          label: "English",
          title: "Microphone Setup",
          paragraphs: [
            "Before starting the experiment, we need to set up your microphone.",
            "On the next page:"
          ],
          listItems: [
            'Your browser will ask for microphone permission. Please click <strong>Allow</strong>.',
            "You'll see a dropdown menu with available microphones.",
            "Select the microphone you want to use.",
            'Click "Use this microphone" to continue.'
          ]
        })}
        ${languageBlock({
          label: "中文",
          title: "麦克风设置",
          paragraphs: [
            "在开始实验之前，我们需要先设置你的麦克风。",
            "在下一页中："
          ],
          listItems: [
            "你的浏览器会请求麦克风权限。请点击<strong>允许</strong>。",
            "你会看到一个包含可用麦克风的下拉菜单。",
            "请选择你想使用的麦克风。",
            '点击“Use this microphone”继续。'
          ]
        })}
      </div>
    </div>
  `,
  choices: [uiLabels.continue]
};
timeline.push(micSetupInstruction);

// Setting up microphone
const micSetup = {
  type: jsPsychInitializeMicrophone
};
timeline.push(micSetup);
    
    // Microphone test trial
    const trialinstructions = {
      type: jsPsychInstructions,
      pages: [`
        <div class="content">
          <div class="instruction-box">
            ${languageBlock({
              label: "English",
              title: "Microphone Test",
              paragraphs: [
                "You'll now test your microphone by making a short recording.",
                'Speak naturally. You can say anything you like, such as: <em>"Testing, one, two, three."</em>'
              ]
            })}
            ${languageBlock({
              label: "中文",
              title: "麦克风测试",
              paragraphs: [
                "现在你将通过一段简短的录音来测试麦克风。",
                '请自然地说话。你可以说任何内容，例如：<em>“测试，一，二，三。”</em>'
              ]
            })}
          </div>
          <div class="tip-box">
            ${languageBlock({
              label: "English",
              title: "Playback Check",
              headingLevel: 3,
              paragraphs: [
                "After recording, you'll be able to play it back to make sure it's working.",
                "If the microphone worked well, you should be able to hear what you recorded.",
                "<strong>Please make sure that your speaker is on and set to an appropriate volume.</strong>"
              ]
            })}
            ${languageBlock({
              label: "中文",
              title: "回放检查",
              headingLevel: 3,
              paragraphs: [
                "录音后，你可以回放录音，以确认麦克风是否正常工作。",
                "如果麦克风工作正常，你应该能够听到自己刚才录下的内容。",
                "<strong>请确认你的扬声器已打开，并调到合适的音量。</strong>"
              ]
            })}
          </div>
          ${languageBlock({
            label: "English",
            title: "Ready to Continue",
            headingLevel: 3,
            paragraphs: [
              `When you're ready, click <strong>"${uiLabels.next}"</strong> to continue to the start screen.`
            ]
          })}
          ${languageBlock({
            label: "中文",
            title: "准备继续",
            headingLevel: 3,
            paragraphs: [
              `准备好后，请点击<strong>“${uiLabels.next}”</strong>进入开始页面。`
            ]
          })}
        </div>
        `
    ],
    show_clickable_nav: true,
    button_label_next: uiLabels.next,
    button_label_previous: uiLabels.back
    };      
    timeline.push(trialinstructions);

    const microphoneTestReady = {
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="content">
          <div class="recording-box">
            ${languageBlock({
              label: "English",
              title: "Microphone Test",
              headingLevel: 3,
              paragraphs: [
                "Take a moment to get ready.",
                "Click the button below when you want to begin the test recording."
              ]
            })}
            ${languageBlock({
              label: "中文",
              title: "麦克风测试",
              headingLevel: 3,
              paragraphs: [
                "请先准备一下。",
                "当你准备开始测试录音时，请点击下面的按钮。"
              ]
            })}
          </div>
        </div>
      `,
      choices: [uiLabels.startRecording],
      data: {
        trial_type_label: 'microphone_test_ready'
      }
    };
    timeline.push(microphoneTestReady);

    const testing = {
      type: jsPsychHtmlAudioResponse,
      stimulus: `
        <div class="content">
          <div class="recording-box">
            ${languageBlock({
              label: "English",
              title: "Recording in Progress...",
              headingLevel: 3,
              paragraphs: [
                'Speak naturally, for example: <em>"Testing, 1, 2, 3."</em>'
              ]
            })}
            ${languageBlock({
              label: "中文",
              title: "正在录音...",
              headingLevel: 3,
              paragraphs: [
                '请自然地说话，例如：<em>“测试，一，二，三。”</em>'
              ]
            })}
          </div>
        </div>
      `,
      show_done_button: true,
      done_button_label: uiLabels.finishRecording,
      recording_duration: 5000,
      allow_playback: true,
      data: {
        trial_type_label: 'microphone_test'
      },
      on_finish: function(data) {
        const filename = `${subject_id}_microphone_test_audio.webm`;
        queueAudioUpload(data, filename);
      }
    };
    timeline.push(testing)

// Begin main experiment
const beginMain = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="content">
      <div class="begin-box">
        ${languageBlock({
          label: "English",
          title: "Let's Begin!",
          paragraphs: [
            "Now the microphone test is done and the main part begins.",
            `Each sentence will appear first, and you'll click <strong>${uiLabels.startRecording}</strong> when you're ready to speak.`,
            "After each sentence, you'll be able to listen to your recording and decide whether to keep it or record again.",
            `Click "${uiLabels.continue}" to start recording the sentences.`
          ]
        })}
        ${languageBlock({
          label: "中文",
          title: "让我们开始吧！",
          paragraphs: [
            "现在麦克风测试已经完成，正式实验即将开始。",
            `每句话会先显示出来，等你准备好说话时，请点击<strong>${uiLabels.startRecording}</strong>。`,
            "每句话录完后，你可以听录音，并决定保留还是重新录音。",
            `点击“${uiLabels.continue}”开始录制这些句子。`
          ]
        })}
      </div>
    </div>
  `,
  choices: [uiLabels.continue]
};
timeline.push(beginMain);

// 5. Recording Task
// Shuffle the trial objects
const shuffled_trials = randomize_trials(trial_objects);

shuffled_trials.forEach(trial_obj => {
  timeline.push(buildSentenceTrial(trial_obj));
});

if (datapipeConfigured) {
  const save_data = {
    type: jsPsychPipe,
    action: "save",
    experiment_id: DATAPIPE_EXPERIMENT_ID,
    filename: data_filename,
    data_string: () => jsPsych.data.get().csv()
  };

  timeline.push(save_data);
}

// Run the experiment
jsPsych.run(timeline);
