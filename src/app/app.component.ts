import { Component, OnInit } from '@angular/core';
import { TrelloService } from './services/trello.service';
import { environment } from 'src/environments/environment';
import { CheckConditionService } from './services/checkCondition.service';
declare let window: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  title = 'powerUpNextTask';
  // promise = trelloPowerUp.Promise;
  NEXT_TASK = 'https://i.imgur.com/5xkAn5M.png';
  UNLOCK = 'https://i.imgur.com/mMlyvyN.png';

  constructor(private trelloService: TrelloService,
              private checkConditionService: CheckConditionService) {}

  ngOnInit() {
    this.trelloInit();
  }

  trelloInit() {
    window.TrelloPowerUp.initialize({
      'card-buttons': (t, options) => {
        return t.getRestApi()
          .getToken()
          .then((token) => {
            if (!token) {
              return [{
                icon: this.UNLOCK,
                text: 'Accept Auth',
                // tslint:disable-next-line:no-shadowed-variable
                callback:  (t) => {
                  this.showIframeAuth(t);
                }
              }];
            } else {
              return [{
                icon: this.NEXT_TASK,
                text: 'Next Task',
                // tslint:disable-next-line:no-shadowed-variable
                callback:  () => {
                  this.showIframeNext(t, token);
                }
              }];
            }
          });
      }, 'card-back-section': (t, options) => {
        return t.getRestApi()
          .getToken()
          .then((token) => {
            if (token) {
              return [{
                title: 'Conditions',
                icon: this.NEXT_TASK, // Must be a gray icon, colored icons not allowed.
                content: {
                  type: 'iframe',
                  url: t.signUrl('./condition'),
                  height: 250 // Max height is 500
                }
              }];
            }
          });
      }
    }, {
        appKey: environment.appKey,
        appName: environment.appName
    });
  }

  showIframeAuth(t) {
    return t.popup({
      title: 'Authorize to continue',
      url: '/authorize'
    });
  }

  showIframeNext(t, token) {
    // Récupération de la carte actuelle
    return t.card('all')
      .then((card) => {
        const idCard = card.id;
        // Récupération du board actuel
        this.getNextTask(idCard, token)
        .then((newListId) => {
          this.trelloService.moveCard(idCard, newListId, token)
            .then((resp) => {
            })
            .catch((error) => {
              console.log(error);
            });
        }).catch((error) => {
          if (!error) {
            t.hideCard();
            return t.alert({
              message: 'Proceso terminado',
              duration: 6,
            });
          } else {
            console.log(error);
            this.showModal(error, t);
          }
        });
      });
  }

  async getNextTask(idCard: string, token: string) {
    return new Promise<any>( async (resolve, reject) => {
      let isPermissionOk = true;
      // Check if they are user assigned to this task and if actual user is one of them
      const cardMembersId = await this.trelloService.getCardMembersId(idCard, token);
      if (cardMembersId.idMembers.length > 0) {
        const idCurrentMember = await this.trelloService.getMemberIdByToken(token);
        if (!cardMembersId.idMembers.includes(idCurrentMember.idMember)) {
          isPermissionOk = false;
        }
      }

      if (isPermissionOk) {
        // Get condition and next tasks
        const conditions = JSON.parse(localStorage.getItem('nextTaskConditions'));
        const userData = JSON.parse(localStorage.getItem('userData')).find(data => data.idCard === idCard);
        const formCurrentTask = JSON.parse(localStorage.getItem('formCurrentTask'));
        if (userData && formCurrentTask) {
          formCurrentTask.forEach(form => {
            if (!(userData.data.find(variable => variable.nameVar === form.nameVar))) {
              reject('You have to end some prerequisite to have a next task !');
            }
          });
        }
        let nextElement;
        if (!conditions || conditions.length === 0) {
          const nextTask = JSON.parse(localStorage.getItem('nextTask'));
          if (nextTask) {
            resolve(nextTask);
          } else {
            reject(null);
          }
        } else if (userData) {
          for (const element of conditions) {
            let conditionRespected = true;
            if (userData.data.find(data => data.nameVar === element.choice.nameVar)) {
              const value = userData.data.find(data => data.nameVar === element.choice.nameVar).value;
              conditionRespected = await this.checkConditionService.checkCondition(element, value);
            } else {
              conditionRespected = false;
            }

            if (conditionRespected) {
              nextElement = element.destination;
            }
          }
          if (nextElement) {
            resolve(nextElement);
          }
        }
        reject('You have to end some prerequisite to have a next task !');
      } else {
        reject('Alguien está asignado a esta tarea, sólo esta persona puede ir a la siguiente tarea');
      }
    });
  }

  showModal(msg: string, t) {
    t.modal({
      // the url to load for the iframe
      url: '/modal',
      accentColor: '#F2D600',
      args: { msg },
      // initial height for iframe
      height: 100, // not used if fullscreen is true
      // whether the modal should stretch to take up the whole screen
      fullscreen: false,
      // optional function to be called if user closes modal (via `X` or escape, etc)
      callback: () => console.log('Goodbye.'),
      // optional title for header chrome
      title: 'Impossible action'
    });
  }

}
