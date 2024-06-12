import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MockModel, OCRResult } from '../model/dto.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {


  constructor(private http: HttpClient) { }

  getData(): Observable<MockModel[]> {
    return this.http.get<MockModel[]>(`${environment.baseUrl}/mock-test`);
  }

  postData(data: any): Observable<OCRResult> {
    return this.http.post<OCRResult>(`${environment.baseUrl}/ocr/ocr-image`, data);
  }
}
