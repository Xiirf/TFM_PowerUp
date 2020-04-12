import { Component, OnInit } from '@angular/core';
import { TrelloService } from 'src/app/services/trello.service';
import { DataService } from 'src/app/services/data.service';
import { environment } from 'src/environments/environment';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { CheckConditionService } from 'src/app/services/checkCondition.service';
declare let TrelloPowerUp: any;

@Component({
  selector: 'app-condition',
  templateUrl: './condition.component.html',
  styleUrls: ['./condition.component.scss']
})

export class ConditionComponent implements OnInit {

  idCard: string;
  firstList: any;
  token: string;
  nextTaskConditions = [];
  userData = [];
  stringList = [];
  nextCondition: {
    name: string,
    choice: {
      nameVar: string,
      value: string,
      type: string,
      operator: string
    },
    id: string,
    idUnique: string,
    posCondition: number
  }; // Define Model
  conditionForm: FormGroup;

  t = TrelloPowerUp.iframe({
    appKey: environment.appKey,
    appName: environment.appName
  });

  constructor(private trelloService: TrelloService,
              private dataService: DataService,
              private fb: FormBuilder,
              private checkConditionService: CheckConditionService) {
    this.createForm();
  }

  createForm(): void {
    this.conditionForm = this.fb.group({
      dataValue: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.nextTaskConditions = [];
    this.t.getRestApi()
      .getToken()
      .then((token) => {
        this.token = token;
        this.t.card('all')
          .then((card) => {
            this.idCard = card.id;
            const idList = card.idList;
            // Récupération du board actuel
            this.t.board('all')
              .then((board) => {
                const idBoard = board.id;
                // On récupère les listes du board actuel
                this.trelloService.getAllListBoard(idBoard, this.token)
                  .then(async (data) => {
                    this.firstList = data[0];
                    // On récupère l'index de la liste suivante (tâches suivante)
                    const index = data.findIndex(list => list.id === idList) + 1;
                    if (index < data.length) {
                      // On récupère les conditions dans la carte conditions
                      if (!localStorage.getItem('currentTaskId') || !(localStorage.getItem('currentTaskId') === idList)
                            || !localStorage.getItem('nextTaskConditions')) {
                        await this.dataService.getData(this.firstList, this.token, 'Conditions_Data_Storage')
                        .then((conditions) => {
                          conditions.forEach(element => {
                            element.lastTask.forEach((id) => {
                              if (id === idList) {
                                this.nextTaskConditions.push(element);
                              }
                            });
                          });
                          // TODO delete + fonction
                          // this.setTaskName(token);
                          this.setLocalStorage(idList, 'Condition');
                        });
                      } else {
                        this.nextTaskConditions = JSON.parse(localStorage.getItem('nextTaskConditions'));
                      }
                    } else {
                      localStorage.removeItem('nextTaskConditions');
                    }
                    if (!localStorage.getItem('currentCardId') || !(localStorage.getItem('currentCardId') === this.idCard)
                            || !localStorage.getItem('userData')) {
                      await this.dataService.getData(this.firstList, this.token, 'User_Data_Storage')
                      .then((dataUser) => {
                        dataUser.forEach(element => {
                          if (element.idCard === this.idCard) {
                            this.userData.push(element);
                          }
                        });
                        this.setLocalStorage(this.idCard, 'UserData');
                      });
                    } else {
                      this.userData = JSON.parse(localStorage.getItem('userData'));
                    }
                    // get next condition
                    this.getNextCondition();
                  })
                  .catch((error) => {
                    console.log(error);
                  });
              });
          });
      });
  }

  async getNextCondition() {
    console.log("USERDATA");
    console.log(this.userData);
    const tabVar = [];
    let commonValue = false;
    if (this.userData.find(data => data.idCard === this.idCard)) {
      console.log("IN");
      this.userData.find(data => data.idCard === this.idCard).data.forEach(data => {
        tabVar.push(data);
      });
    }
    console.log("tabVar");
    console.log(tabVar);
    this.nextCondition = null;
    for (const taskCondition of this.nextTaskConditions) {
      console.log('TOUR2');
      let stop = false;
      let pos;
      if (tabVar.length > 0) {
        for (const variable of tabVar) {
          console.log('TOUR');
          if (!stop) {
            if (taskCondition.conditions.find(condition => condition.choice.nameVar === variable.nameVar)) {
              commonValue = true;
              console.log(variable.nameVar);
              console.log(taskCondition.conditions.find(condition => condition.choice.nameVar === variable.nameVar));
              stop = !(await this.checkConditionService.checkCondition(
                taskCondition.conditions.find(condition => condition.choice.nameVar === variable.nameVar), variable.value));
              console.log(stop);
              } else {
              stop = true;
            }
          }
        }
      }
      if (!stop || !(tabVar.length > 0) || !commonValue) {
        taskCondition.conditions.forEach(condition => {
          if (!pos || condition.posCondition < pos) {
            if (!tabVar.find(variable => variable.nameVar === condition.choice.nameVar)) {
              pos = condition.posCondition;
              this.nextCondition = condition;
            }
          }
        });
      }
    }
    // Set stringList if the nextCondition is a string
    if (this.nextCondition && ( this.nextCondition.choice.type === 'string' || this.nextCondition.choice.type === 'boolean')) {
      this.stringList = [];
      this.stringList.push(this.nextCondition.choice.value);
      this.nextTaskConditions.forEach(taskCondition => {
        if (taskCondition.conditions.find(condition => (condition.id === this.nextCondition.id) &&
        (condition.idUnique !== this.nextCondition.idUnique))) {
          this.stringList.push(taskCondition.conditions.find(condition => (condition.id === this.nextCondition.id) &&
          (condition.idUnique !== this.nextCondition.idUnique)).choice.value);
        }
      });
    }
    console.log(this.nextCondition);
  }

  async saveData() {
    const dataVar = {
      nameVar: this.nextCondition.choice.nameVar,
      value: this.conditionForm.get('dataValue').value
    };
    if (!this.userData.find(data => data.idCard === this.idCard)) {
      this.userData.push({
        idCard: this.idCard,
        data: []
      });
    }
    this.userData.find(data => data.idCard === this.idCard).data.push(dataVar);
    localStorage.setItem('userData', JSON.stringify(this.userData));
    await this.dataService.setData(this.firstList, this.token, 'User_Data_Storage', JSON.stringify(this.userData));
    this.getNextCondition();
  }

  /*setTaskName(token: string) {
    this.nextTaskConditions.forEach(condition => {
      this.trelloService.getListInformation(condition.idTask, token)
        .then((list) => {
          condition.nameTask = list.name;
          localStorage.setItem('nextTaskConditions', JSON.stringify(this.nextTaskConditions));
        });
    });
  }*/

  /*onCheckboxChange(e, isChecked, id) {
    this.nextTaskConditions.forEach(item => {
      item.conditions.forEach(condition => {
        if (condition.idUnique === id) {
          this.isSameConditionAlreadySelected(condition.id, condition.idUnique)
          .then(_ => {
            condition.isChecked = !isChecked;
            localStorage.setItem('nextTaskConditions', JSON.stringify(this.nextTaskConditions));
          }).catch(() => {
            e.preventDefault();
            this.showModal('These are exclusive conditions you cannot choose two choices from the same condition.');
          });
        }
      });
    });
  }*/

  /*showModal(msg: string) {
    this.t.modal({
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
  }*/

  setLocalStorage(id: string, object: string) {
    if (object === 'Condition') {
      localStorage.setItem('currentTaskId', id);
      localStorage.setItem('nextTaskConditions', JSON.stringify(this.nextTaskConditions));
    } else if (object === 'UserData') {
      localStorage.setItem('currentCardId', id);
      localStorage.setItem('userData', JSON.stringify(this.userData));
    }
  }
}
