import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddRootFeaturesComponent } from '../add-root-features/add-root-features.component';
import { GlobalPresetsComponent } from '../global-presets/global-presets.component';
import { FeatureAuditComponent } from '../feature-audit/feature-audit.component';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../api.service';
import { SetupObjectService, IDX_OF_ID_COL_IDXS, IDX_OF_NON_ID_COL_IDXS } from '../../setup-object.service';
import { AppliedFilterSelections } from '../../models'

@Component({
  selector: 'app-audit-summary',
  templateUrl: './audit-summary.component.html',
  styleUrls: ['./audit-summary.component.css'],
  providers: [DatePipe]
})
export class AuditSummaryComponent implements OnInit {
  expanded = false;
  auditOpened = false;
  myDate = new Date();
  columns = ["Action", "Last Updated", "Room ID", "Clockwise Number"]

  // for getting setupObject:
  setupObject;
  globalSelectors;
  appliedFilterSelections: AppliedFilterSelections = {
    numericChoice: {},
    numericEqual: {},
    calendarRange: {},
    calendarEqual: {},
    dropdown: {},
    searchableDropdown: [],
    checklistDropdown: [],
    searchableChecklistDropdown: [],
    text: {},
    bool: {},
    _placeholder: "placeholder"
  };
  defaultColumns = [];
  rootFeatures = [];
  auditTreeIDobjects = {};
  auditReturnableIDs;

  // for optimistic updating from the dialogs
  displayedRootFeatures = [];
  IDX_OF_ID_COL_IDXS = IDX_OF_ID_COL_IDXS;
  IDX_OF_NON_ID_COL_IDXS = IDX_OF_NON_ID_COL_IDXS;
  getProp(col) {
    return col.replace(/\s+/g, '_');
  }

  constructor(public dialog: MatDialog, private datePipe: DatePipe,
    private apiService: ApiService, private setupObjectService: SetupObjectService) {
  }

  auditName = localStorage.getItem('currentlyEditingAuditName')

  //  hardcord data, delete eventually
  audits = [
    { name: "Restroom Audit", included: true, features: [{ name: "Toilet", included: true, actions: [{ Action: "Removal", Last_Updated: "5 mins ago", Room_ID: "1201B", Clockwise_Number: 8 }, { Action: "Creation", Last_Updated: "3 days ago", Room_ID: "1201B", Clockwise_Number: 4 }, { Action: "Observation", Last_Updated: "3 days ago", Room_ID: "1201B", Clockwise_Number: 5 }] }, { name: "Sink", included: true, actions: [{ Action: "Deletion Request", Last_Updated: "45 mins ago", Room_ID: "1201B", Clockwise_Number: 3 }, { Action: "Creation and Observation", Last_Updated: "4 months ago", Room_ID: "1201B", Clockwise_Number: 7 }] }, { name: "Urinal", included: true, actions: [{ Action: "Creation", Last_Updated: "1 hr ago", Room_ID: "1201B", Clockwise_Number: 2 }, { Action: "Observation", Last_Updated: "1 hr ago", Room_ID: "1201B", Clockwise_Number: 1 }] }] },
    { name: "Irrigation Audit", included: true, features: [{ name: "Sprinkler", included: true, actions: [{ Action: "Creation", Last_Updated: "12 mins ago", Room_ID: "23A", Clockwise_Number: 2 }, { Action: "Observation", Last_Updated: "33 mins ago", Room_ID: "23A", Clockwise_Number: 4 }] }, { name: "Canal", included: true, actions: [{ Action: "Creation and Observation", Last_Updated: "3 weeks ago", Room_ID: "23A", Clockwise_Number: 13 }] }, { name: "Sewer", included: true, actions: [{ Action: "Deletion Request", Last_Updated: "3 weeks ago", Room_ID: "23A", Clockwise_Number: 9 }, { Action: "Observation and Creation", Last_Updated: "3 weeks ago", Room_ID: "23A", Clockwise_Number: 3 }] }] },
    { name: "Boiler Room Audit", included: true, features: [{ name: "Boiler", included: true, actions: [{ Action: "Removal", Last_Updated: "1 year ago", Room_ID: "11C", Clockwise_Number: 22 }, { Action: "Creation", Last_Updated: "12 years ago", Room_ID: "11C", Clockwise_Number: 16 }] }, { name: "Pump", included: true, actions: [{ Action: "Deletion Request", Last_Updated: "3 years ago", Room_ID: "12B", Clockwise_Number: 9 }, { Action: "Creation", Last_Updated: "65 years ago", Room_ID: "12B", Clockwise_Number: 7 }] }] }
  ]
  // end hardcode data

  ngOnInit(): void {
    // get setupObject and rootFeatures
    this.getSetupObject();
  }

  getSetupObject() {
    this.apiService.getSetupObject().subscribe((res) => {
      this.setupObject = res;
      this.rootFeatures = this.setupObjectService.getRootFeatures(this.setupObject)
      this.displayedRootFeatures = this.rootFeatures;
      this.auditTreeIDobjects = this.setupObjectService.getAllAuditItemRelatedColumns(this.setupObject);
      this.auditReturnableIDs = this.setupObjectService.getAllIDreturnableIDs(this.auditTreeIDobjects)
      console.log("auditReturnableIDs", this.auditReturnableIDs)
      console.log("auditTreeIDObjects", this.auditTreeIDobjects)
    });
  }

  openRootFeatures(): void {
    const dialogRef = this.dialog.open(AddRootFeaturesComponent, {
      width: '801px',
      maxHeight: '500px',
      data: [this.audits, this.displayedRootFeatures],
    })
    const sub = dialogRef.componentInstance.notify.subscribe((emission) => {
      this.displayedRootFeatures = this.rootFeatures.filter(feature => emission.indexOf(feature.name) >= 0);
    })
  }

  showOrHideTable(feature) {
    console.log(feature);
    const tableElement = document.getElementById(feature)
    if (tableElement.style.display == 'none') {
      document.getElementById(feature).style.display = "inline-table"
      document.getElementById(feature + ' caret').classList.remove("fa-caret-down");
      document.getElementById(feature + ' caret').classList.add('fa-caret-right');
    }
    else {
      document.getElementById(feature).style.display = "none"
      document.getElementById(feature + ' caret').classList.remove("fa-caret-right");
      document.getElementById(feature + ' caret').classList.add('fa-caret-down');
    }
  }

  checkIfTableShown(feature) {
    if (document.getElementById(feature).style.display == 'none') {
      return false;
    }
    return true;
  }

  openGlobalPresets(): void {
    const dialogRef = this.dialog.open(GlobalPresetsComponent, {
      panelClass: 'audit-dialog-no-padding',
      width: '801px',
      data: this.audits
    })
  }

  openFeatureAudit(feature): void {
    this.auditOpened = true;
    const dialogRef = this.dialog.open(FeatureAuditComponent, {
      width: '801px',
      data: feature
    })
    dialogRef.afterClosed().subscribe((e) => this.auditOpened = false)
  }

  save() {
    console.log(this.auditTreeIDobjects)

  }
}