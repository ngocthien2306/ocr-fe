import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MockModel, OCRResult } from '../model/dto.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private apiUrl = 'https://192.168.1.98:8080'; // Replace with your backend API URL

  constructor(private http: HttpClient) { }

  getData(): Observable<MockModel[]> {
    return this.http.get<MockModel[]>(`${this.apiUrl}/mock-test`);
  }

  postData(data: any): Observable<OCRResult> {
    return this.http.post<OCRResult>(`${this.apiUrl}/ocr/ocr-image`, data);
  }
}
