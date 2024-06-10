import {Component, OnInit} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {WebcamImage} from './modules/webcam/domain/webcam-image';
import {WebcamUtil} from './modules/webcam/util/webcam.util';
import {WebcamInitError} from './modules/webcam/domain/webcam-init-error';
import { ApiService } from './modules/api/api.service';
import { MockModel, OCRResult } from './modules/model/dto.model';

@Component({
  selector: 'appRoot',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  steps = [0, 1, 2];
  currentStep = 0;
  formData = {
    rpm: '',
    oilt: '',
    password: ''
  };

  showImageYN: boolean = false;
  base64: string =  "";
  sendRequestClick: boolean = false;
  ocr_yn = false;
  call_success_yn = true;
  
  students: MockModel[];
  // toggle webcam on/off
  public showWebcam = true;
  public allowCameraSwitch = true;
  public multipleWebcamsAvailable = false;
  public deviceId: string;
  public facingMode: string = 'environment';
  public messages: any[] = [];

  // latest snapshot
  public webcamImage: WebcamImage = null;

  // webcam snapshot trigger
  private trigger: Subject<void> = new Subject<void>();
  // switch to next / previous / specific webcam; true/false: forward/backwards, string: deviceId
  private nextWebcam: Subject<boolean|string> = new Subject<boolean|string>();

  constructor(private apiService: ApiService) { }
  
  public ngOnInit(): void {
    this.readAvailableVideoInputs();
  }

  goToStep(step: number) {
    if (this.isStepValid(step)) {
      this.currentStep = step;
    }
  }

  nextStep() {
    if (this.isCurrentStepValid()) {
      this.currentStep++;
    }
  }

  previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  isStepValid(step: number): boolean {
    switch(step) {
      case 0:
        return this.formData.rpm.trim() !== '' &&  this.formData.oilt.trim() !== '';
      case 1:
        return this.formData.oilt.trim() !== '';
      case 2:
        return this.formData.password.trim() !== '';
      default:
        return false;
    }
  }

  isCurrentStepValid(): boolean {
    return this.isStepValid(this.currentStep);
  }

  submitForm() {
    if (this.isCurrentStepValid()) {
      console.log('Form submitted:', this.formData);
      // You can handle form submission here
    }
  }

  public triggerSnapshot(): void {
    this.trigger.next();
    this.sendRequestClick = true;
    const data = {
      'image_base64': this.webcamImage.imageAsBase64,
      'point1': this.webcamImage.point1,
      'point2': this.webcamImage.point2
    }
    console.log(data);
    this.apiService.postData(data).toPromise()
    .then((res: OCRResult) => {
      this.formData.rpm = res.rpm;
      this.formData.oilt = res.oilt;
      this.sendRequestClick = false;
      this.showImageYN =  true;
      this.base64 = "data:image/jpeg;base64," + res.base64_image;
      if (this.formData.oilt.trim() === '' && this.formData.oilt.trim() === '') {
        this.ocr_yn = true;
      }
      else {
        this.ocr_yn = false;
      }

      this.call_success_yn = true;

      console.log(res);
    })
    .catch((error) => {
      console.error('Error posting:', error);
      this.sendRequestClick = false;
      this.call_success_yn = false;
    });

  }

  public toggleWebcam(): void {
    this.showWebcam = !this.showWebcam;
  }

  public handleInitError(error: WebcamInitError): void {
    this.messages.push(error);
    if (error.mediaStreamError && error.mediaStreamError.name === 'NotAllowedError') {
      this.addMessage('User denied camera access');
    }
  }

  public showNextWebcam(directionOrDeviceId: boolean|string): void {
    this.nextWebcam.next(directionOrDeviceId);
  }

  public handleImage(webcamImage: WebcamImage): void {
    this.addMessage('Received webcam image');
    console.log(webcamImage);
    this.webcamImage = webcamImage;
  }

  public cameraWasSwitched(deviceId: string): void {
  // this.addMessage('Active device: ' + deviceId);
    this.deviceId = deviceId;
    this.readAvailableVideoInputs();
  }

  addMessage(message: any): void {
    console.log(message);
    this.messages.unshift(message);
  }

  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  public get nextWebcamObservable(): Observable<boolean|string> {
    return this.nextWebcam.asObservable();
  }

  public get videoOptions(): MediaTrackConstraints {
    const result: MediaTrackConstraints = {};
    if (this.facingMode && this.facingMode !== '') {
      result.facingMode = { ideal: this.facingMode };
    }

    return result;
  }

  private readAvailableVideoInputs() {
    WebcamUtil.getAvailableVideoInputs()
      .then((mediaDevices: MediaDeviceInfo[]) => {
        this.multipleWebcamsAvailable = mediaDevices && mediaDevices.length > 1;
      });
  }
}
