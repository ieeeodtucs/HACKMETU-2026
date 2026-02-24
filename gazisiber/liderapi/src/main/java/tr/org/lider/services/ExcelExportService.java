package tr.org.lider.services;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.sql.Timestamp;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import tr.org.lider.entities.AgentImpl;
import tr.org.lider.entities.AgentPropertyImpl;
import tr.org.lider.entities.CommandImpl;
import tr.org.lider.entities.OperationLogImpl;
import tr.org.lider.entities.UserSessionImpl;
import tr.org.lider.messaging.enums.StatusCode;
import tr.org.lider.utils.IUserSessionReport;

@Service
public class ExcelExportService {

	Logger logger = LoggerFactory.getLogger(ExcelExportService.class);

	public byte[] generateAgentReport(List<AgentImpl> agents) {
		int rowCount = 0;
		String exportFile = getFileWriteLocation() 
				+ "İstemci Raporu_" 
				+ new SimpleDateFormat("ddMMyyyyHH:mm:ss.SSS").format(new Date())
				+ ".xlsx";
		XSSFWorkbook wb = new XSSFWorkbook();

		Font fontTextColourRed = wb.createFont();
		fontTextColourRed.setColor(IndexedColors.RED.getIndex());

		Font ftArial = wb.createFont();
		ftArial.setFontName("Arial");

		Font fontTextBold = wb.createFont();
		fontTextBold.setBold(true);
		fontTextBold.setFontName("Arial");
		fontTextBold.setFontHeightInPoints((short) 10);

		CellStyle csBoldAndBordered = wb.createCellStyle();
		csBoldAndBordered.setFont(fontTextBold);
		csBoldAndBordered.setBorderBottom(BorderStyle.THIN);
		csBoldAndBordered.setBorderTop(BorderStyle.THIN);
		csBoldAndBordered.setBorderLeft(BorderStyle.THIN);
		csBoldAndBordered.setBorderRight(BorderStyle.THIN);
		
		CellStyle csBordered = wb.createCellStyle();
		csBordered.setBorderBottom(BorderStyle.THIN);
		csBordered.setBorderTop(BorderStyle.THIN);
		csBordered.setBorderLeft(BorderStyle.THIN);
		csBordered.setBorderRight(BorderStyle.THIN);

		CellStyle csTextColourRed = wb.createCellStyle();
		csTextColourRed.setFont(fontTextColourRed);

		CellStyle csTextBold= wb.createCellStyle();
		csTextBold.setFont(fontTextBold);

		CellStyle csCenter = wb.createCellStyle();
		csCenter.setAlignment(HorizontalAlignment.CENTER);
		csCenter.setFont(ftArial);

		XSSFSheet sheet = wb.createSheet("Detaylı İstemci Raporu");

		//Add header
		Row row = null; 
		Cell cell = null;

		int maxCountOfMacAddresses = 0;
		int maxCountOfIPAddresses = 0;
		
		List<Integer> colWidthList = new ArrayList<Integer>();
		List<String> headers = new ArrayList<String>();
		
		Collections.addAll(headers, "", "Bilgisayar Adı","DN", "Durumu","Aktif/Pasif");
		Collections.addAll(colWidthList, 2500, 3500,8000, 4000,3000);
		for (AgentImpl agent : agents) {
			if(maxCountOfIPAddresses < agent.getIpAddresses().split(",").length) {
				maxCountOfIPAddresses = agent.getIpAddresses().split(",").length;
			}
			if(maxCountOfMacAddresses < agent.getMacAddresses().split(",").length) {
				maxCountOfMacAddresses = agent.getIpAddresses().split(",").length;
			}
		}

		for (int i = 0; i < maxCountOfMacAddresses; i++) {
			headers.add("MAC Adresi " + String.valueOf(i+1));
			colWidthList.add(5000);
		}

		for (int i = 0; i < maxCountOfIPAddresses; i++) {
			headers.add("IP Adresi " + String.valueOf(i+1));
			colWidthList.add(5000);
		}

		Collections.addAll(headers, "Oluşturulma Tarihi", "İşletim Sistemi Versiyonu", "Ahenk Versiyonu",
				"Marka", "Model", "İşlemci", "RAM(GB)", "Toplam Disk Alanı(GB)", "Kullanılan Disk Alanı(GB)", "Boş Disk Alanı(GB)");
		Collections.addAll(colWidthList, 5500, 11500, 6000, 7000, 4000, 12000, 4000, 6000, 6000, 6000);
		row = sheet.createRow(rowCount++);
		for (int i = 0; i < headers.size(); i++) {
			sheet.setColumnWidth(i, colWidthList.get(i));
			cell = row.createCell(i);
			cell.setCellValue(headers.get(i));
			cell.setCellStyle(csBoldAndBordered);
		}
		int counter = 1;
		for (AgentImpl agent : agents) {
			int colCount = 0;
			row = sheet.createRow(rowCount++);  
			cell = row.createCell(colCount++);
			cell.setCellValue(String.valueOf(counter++));
			cell.setCellStyle(csBordered);
			
			String osVersion = "";
			String agentVersion = "";
			String processor = "";
			String brand = "";
			String model = "";
			String memory = "";
			String diskTotal = "";
			String diskUsed = "";
			int diskTotalCeil = 0;
			Double diskUsedDouble = 0.0;
			for (AgentPropertyImpl property: agent.getProperties()) {
				if(property.getPropertyName().equals("os.version")) {
					osVersion = property.getPropertyValue();
				}
				if(property.getPropertyName().equals("agentVersion")) {
					agentVersion = property.getPropertyValue();
				}
				if(property.getPropertyName().equals("processor")) {
					processor = property.getPropertyValue();
				}
				if(property.getPropertyName().equals("hardware.baseboard.manufacturer")) {
					brand = property.getPropertyValue();
				}
				if(property.getPropertyName().equals("hardware.baseboard.productName")) {
					model = property.getPropertyValue();
				}
				if(property.getPropertyName().equals("hardware.memory.total")) {
					double value = Integer.parseInt(property.getPropertyValue())/1000.0;
					memory = String.valueOf((int) Math.ceil(value));
				}
				if(property.getPropertyName().equals("hardware.disk.total")) {
					double value = Integer.parseInt(property.getPropertyValue())/1000.0;
					diskTotalCeil = (int)Math.ceil(value);
					diskTotal = String.valueOf((int)Math.ceil(value));
				}
				if(property.getPropertyName().equals("hardware.disk.used")) {
					double value = Integer.parseInt(property.getPropertyValue())/1000.0;
					diskUsedDouble = value;
					diskUsed = String.valueOf(String.format(Locale.forLanguageTag("tr-TR"), "%.2f", value));
				}
			}

			cell = row.createCell(colCount++);
			cell.setCellValue(agent.getHostname());
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(agent.getDn());
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			if(agent.getIsOnline()) {
				cell.setCellValue("Çevrimiçi");
				cell.setCellStyle(csBordered);
			} else {
				cell.setCellValue("Çevrimdışı");
				cell.setCellStyle(csBordered);
			}

			
			 if(agent.getAgentStatus() != null) {
		        	Integer intValue = agent.getAgentStatus().getId();
		        	
		        	if(intValue == 0) {
		        		cell = row.createCell(colCount++);
			            cell.setCellValue("Pasif");
			            cell.setCellStyle(csBordered);
		        	}
		        	else if(intValue == 1) {
		        		cell = row.createCell(colCount++);
			            cell.setCellValue("Aktif");
			            cell.setCellStyle(csBordered);
		        	}	
		        	else if(intValue == 2) {
		        		cell = row.createCell(colCount++);
			            cell.setCellValue("Askıda");
			            cell.setCellStyle(csBordered);
		        	}
		        
		        }

			for (int i = 0; i < maxCountOfMacAddresses; i++) {
				try {
					cell = row.createCell(colCount++);
					cell.setCellValue(agent.getMacAddresses().split(",")[i].replace("'", "").trim());
					cell.setCellStyle(csBordered);
				} catch (Exception e) {
					cell.setCellValue("");
					cell.setCellStyle(csBordered);
				}
			}

			for (int i = 0; i < maxCountOfIPAddresses; i++) {
				try {
					cell = row.createCell(colCount++);
					cell.setCellValue(agent.getIpAddresses().split(",")[i].replace("'", "").trim());
					cell.setCellStyle(csBordered);
				} catch (Exception e) {
					cell.setCellValue("");			
					cell.setCellStyle(csBordered);
				}
			}

			cell = row.createCell(colCount++);
			cell.setCellValue(new SimpleDateFormat("dd/MM/yyyy HH:mm:ss").format(agent.getCreateDate()));
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(osVersion);
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(agentVersion);
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(brand);
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(model);
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(processor);
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(memory);
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(diskTotal);
			cell.setCellStyle(csBordered);

			cell = row.createCell(colCount++);
			cell.setCellValue(diskUsed);
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(String.valueOf(String.format(Locale.forLanguageTag("tr-TR"), "%.2f", (diskTotalCeil - diskUsedDouble))));
			cell.setCellStyle(csBordered);
			
			colCount = 0;
		}

		try {
			FileOutputStream outputStream = new FileOutputStream(exportFile);
			wb.write(outputStream);
			wb.close();
		} catch (FileNotFoundException e) {
			e.printStackTrace();
		} catch (IOException e) {
			e.printStackTrace();
		}
		return fileToByteCode(exportFile);
	}
	
	
	
	public byte[] generateTaskReport(List<CommandImpl> commands) {
		int rowCount = 0;
		String exportFile = getFileWriteLocation() 
				+ "Task Raporu_" 
				+ new SimpleDateFormat("ddMMyyyyHH:mm:ss.SSS").format(new Date())
				+ ".xlsx";
		XSSFWorkbook wb = new XSSFWorkbook();

		Font fontTextColourRed = wb.createFont();
		fontTextColourRed.setColor(IndexedColors.RED.getIndex());

		Font ftArial = wb.createFont();
		ftArial.setFontName("Arial");

		Font fontTextBold = wb.createFont();
		fontTextBold.setBold(true);
		fontTextBold.setFontName("Arial");
		fontTextBold.setFontHeightInPoints((short) 10);

		CellStyle csBoldAndBordered = wb.createCellStyle();
		csBoldAndBordered.setFont(fontTextBold);
		csBoldAndBordered.setBorderBottom(BorderStyle.THIN);
		csBoldAndBordered.setBorderTop(BorderStyle.THIN);
		csBoldAndBordered.setBorderLeft(BorderStyle.THIN);
		csBoldAndBordered.setBorderRight(BorderStyle.THIN);
		
		CellStyle csBordered = wb.createCellStyle();
		csBordered.setBorderBottom(BorderStyle.THIN);
		csBordered.setBorderTop(BorderStyle.THIN);
		csBordered.setBorderLeft(BorderStyle.THIN);
		csBordered.setBorderRight(BorderStyle.THIN);

		CellStyle csTextColourRed = wb.createCellStyle();
		csTextColourRed.setFont(fontTextColourRed);

		CellStyle csTextBold= wb.createCellStyle();
		csTextBold.setFont(fontTextBold);

		CellStyle csCenter = wb.createCellStyle();
		csCenter.setAlignment(HorizontalAlignment.CENTER);
		csCenter.setFont(ftArial);

		XSSFSheet sheet = wb.createSheet("Detaylı İstemci Raporu");
		
		//Add header
		Row row = null; 
		Cell cell = null;
		
		List<Integer> colWidthList = new ArrayList<Integer>();
		List<String> headers = new ArrayList<String>();
		
		Collections.addAll(headers, " ", "Eklenti", "Görev",
				"Oluşturulma Tarihi", "Gönderen", "Toplam", "Başarılı", "Gönderildi", "Hata", "Zamanlı Çalıştırılan");
		Collections.addAll(colWidthList, 3500, 7500, 16000, 4000, 4000, 4000, 4000, 4000, 4000, 6000);
		
		row = sheet.createRow(rowCount++);
		for (int i = 0; i < headers.size(); i++) {
			sheet.setColumnWidth(i, colWidthList.get(i));
			cell = row.createCell(i);
			cell.setCellValue(headers.get(i));
			cell.setCellStyle(csBoldAndBordered);
		}
		int counter = 1;
		
		for (CommandImpl command: commands) {
			int colCount = 0;
			row = sheet.createRow(rowCount++);  
			cell = row.createCell(colCount++);
			cell.setCellValue(String.valueOf(counter++));
			cell.setCellStyle(csBordered);
			int success = 0;
			int fail = 0;
			int waiting = 0;
			
			cell = row.createCell(colCount++);
			cell.setCellValue(command.getTask().getPlugin().getDescription());
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(command.getTask().getPlugin().getDescription());
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(new SimpleDateFormat("dd/MM/yyyy HH:mm:ss").format(command.getCreateDate()));
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(command.getCommandOwnerUid());
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(command.getUidList().size());
			cell.setCellStyle(csBordered);
			
			for(int i = 0; i < command.getCommandExecutions().size(); i++) {
				if(command.getCommandExecutions().get(i).getCommandExecutionResults().size() < 1){
					waiting++;
				}
				else if(command.getCommandExecutions().get(i).getCommandExecutionResults().size() > 0) {
					StatusCode responseCode = command.getCommandExecutions().get(i).getCommandExecutionResults().get(0).getResponseCode();
					if(responseCode.equals(StatusCode.TASK_PROCESSED))
						success++;
					else 
						fail++;
				}
			}

				cell = row.createCell(colCount++);
				cell.setCellValue(success);
				cell.setCellStyle(csBordered);

				cell = row.createCell(colCount++);
				cell.setCellValue(waiting);
				cell.setCellStyle(csBordered);
	
				cell = row.createCell(colCount++);
				cell.setCellValue(fail);
				cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			if(command.getTask().getCronExpression() != null) {
				cell.setCellValue("EVET");
			}else
				cell.setCellValue("HAYIR");
			cell.setCellStyle(csBordered);
			
			colCount= 0;
			
		}
		
		
		try {
			FileOutputStream outputStream = new FileOutputStream(exportFile);
			wb.write(outputStream);
			wb.close();
		} catch (FileNotFoundException e) {
			e.printStackTrace();
		} catch (IOException e) {
			e.printStackTrace();
		}
		return fileToByteCode(exportFile);

	}
	
	
	
	public byte[] generateOperationLogReport(List<OperationLogImpl> logs) {
		int rowCount = 0;
		String exportFile = getFileWriteLocation() 
				+ "Sistem Güncesi Raporu_" 
				+ new SimpleDateFormat("ddMMyyyyHH:mm:ss.SSS").format(new Date())
				+ ".xlsx";
		XSSFWorkbook wb = new XSSFWorkbook();

		Font fontTextColourRed = wb.createFont();
		fontTextColourRed.setColor(IndexedColors.RED.getIndex());

		Font ftArial = wb.createFont();
		ftArial.setFontName("Arial");

		Font fontTextBold = wb.createFont();
		fontTextBold.setBold(true);
		fontTextBold.setFontName("Arial");
		fontTextBold.setFontHeightInPoints((short) 10);

		CellStyle csBoldAndBordered = wb.createCellStyle();
		csBoldAndBordered.setFont(fontTextBold);
		csBoldAndBordered.setBorderBottom(BorderStyle.THIN);
		csBoldAndBordered.setBorderTop(BorderStyle.THIN);
		csBoldAndBordered.setBorderLeft(BorderStyle.THIN);
		csBoldAndBordered.setBorderRight(BorderStyle.THIN);
		
		CellStyle csBordered = wb.createCellStyle();
		csBordered.setBorderBottom(BorderStyle.THIN);
		csBordered.setBorderTop(BorderStyle.THIN);
		csBordered.setBorderLeft(BorderStyle.THIN);
		csBordered.setBorderRight(BorderStyle.THIN);

		CellStyle csTextColourRed = wb.createCellStyle();
		csTextColourRed.setFont(fontTextColourRed);

		CellStyle csTextBold= wb.createCellStyle();
		csTextBold.setFont(fontTextBold);

		CellStyle csCenter = wb.createCellStyle();
		csCenter.setAlignment(HorizontalAlignment.CENTER);
		csCenter.setFont(ftArial);

		XSSFSheet sheet = wb.createSheet("Sistem Güncesi Raporu");
		
		//Add header
		Row row = null; 
		Cell cell = null;
		
		List<Integer> colWidthList = new ArrayList<Integer>();
		List<String> headers = new ArrayList<String>();
		
		Collections.addAll(headers, " ", "Günce Tipi",
				"Oluşturulma Tarihi", "Mesaj", "Kullanıcı Adı", "IP Adresi");
		Collections.addAll(colWidthList, 3500, 5500, 5500 ,16000, 14000, 4000);
		
		row = sheet.createRow(rowCount++);
		for (int i = 0; i < headers.size(); i++) {
			sheet.setColumnWidth(i, colWidthList.get(i));
			cell = row.createCell(i);
			cell.setCellValue(headers.get(i));
			cell.setCellStyle(csBoldAndBordered);
		}
		int counter = 1;
		
		for (OperationLogImpl log: logs) {
			int colCount = 0;
			row = sheet.createRow(rowCount++);  
			cell = row.createCell(colCount++);
			cell.setCellValue(String.valueOf(counter++));
			cell.setCellStyle(csBordered);
			
			
			cell = row.createCell(colCount++);
			cell.setCellValue(log.getCrudType().toString());
			cell.setCellStyle(csBordered);
			
			
			cell = row.createCell(colCount++);
			cell.setCellValue(new SimpleDateFormat("dd/MM/yyyy HH:mm:ss").format(log.getCreateDate()));
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(log.getLogMessage());
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(log.getUserId());
			cell.setCellStyle(csBordered);
			
			cell = row.createCell(colCount++);
			cell.setCellValue(log.getRequestIp());
			cell.setCellStyle(csBordered);
			
			
			colCount= 0;
			
		}
		
		
		try {
			FileOutputStream outputStream = new FileOutputStream(exportFile);
			wb.write(outputStream);
			wb.close();
		} catch (FileNotFoundException e) {
			e.printStackTrace();
		} catch (IOException e) {
			e.printStackTrace();
		}
		return fileToByteCode(exportFile);

	}
	
	public byte[] generateUserSessionReport(List<IUserSessionReport> users) {
		int rowCount = 0;
		String exportFile = getFileWriteLocation() 
				+ "Oturum Raporu_" 
				+ new SimpleDateFormat("ddMMyyyyHH:mm:ss.SSS").format(new Date())
				+ ".xlsx";
		XSSFWorkbook wb = new XSSFWorkbook();

		Font fontTextColourRed = wb.createFont();
		fontTextColourRed.setColor(IndexedColors.RED.getIndex());

		Font ftArial = wb.createFont();
		ftArial.setFontName("Arial");

		Font fontTextBold = wb.createFont();
		fontTextBold.setBold(true);
		fontTextBold.setFontName("Arial");
		fontTextBold.setFontHeightInPoints((short) 10);

		CellStyle csBoldAndBordered = wb.createCellStyle();
		csBoldAndBordered.setFont(fontTextBold);
		csBoldAndBordered.setBorderBottom(BorderStyle.THIN);
		csBoldAndBordered.setBorderTop(BorderStyle.THIN);
		csBoldAndBordered.setBorderLeft(BorderStyle.THIN);
		csBoldAndBordered.setBorderRight(BorderStyle.THIN);
		
		CellStyle csBordered = wb.createCellStyle();
		csBordered.setBorderBottom(BorderStyle.THIN);
		csBordered.setBorderTop(BorderStyle.THIN);
		csBordered.setBorderLeft(BorderStyle.THIN);
		csBordered.setBorderRight(BorderStyle.THIN);

		CellStyle csTextColourRed = wb.createCellStyle();
		csTextColourRed.setFont(fontTextColourRed);

		CellStyle csTextBold= wb.createCellStyle();
		csTextBold.setFont(fontTextBold);

		CellStyle csCenter = wb.createCellStyle();
		csCenter.setAlignment(HorizontalAlignment.CENTER);
		csCenter.setFont(ftArial);

		XSSFSheet sheet = wb.createSheet("Kullanıcı Oturum Raporu");

		//Add header
		Row row = null; 
		Cell cell = null;

		
		List<Integer> colWidthList = new ArrayList<Integer>();
		List<String> headers = new ArrayList<String>();
		
		int counter = 1;
		int maxCountOfMacAddresses = 0;
		int maxCountOfIPAddresses = 0;
		
		
		
		Collections.addAll(headers, " ", "Kullanıcı Adı","Aktif/Pasif","Oturum Tipi", "Tarih", "Bilgisayar Adı");
		Collections.addAll(colWidthList, 1500, 4000,3000, 4500 ,4500, 4000);
		
		for (IUserSessionReport user : users) {
			if(maxCountOfIPAddresses < user.getIpAddresses().split(",").length) {
				maxCountOfIPAddresses = user.getIpAddresses().split(",").length;
			}
			if(maxCountOfMacAddresses < user.getMacAddresses().split(",").length) {
				maxCountOfMacAddresses = user.getMacAddresses().split(",").length;
			}
		}

		for (int i = 0; i < maxCountOfMacAddresses; i++) {
			headers.add("MAC Adresi " + String.valueOf(i+1));
			colWidthList.add(5000);
		}

		for (int i = 0; i < maxCountOfIPAddresses; i++) {
			headers.add("IP Adresi " + String.valueOf(i+1));
			colWidthList.add(5000);
		}
		
		row = sheet.createRow(rowCount++);
		for (int i = 0; i < headers.size(); i++) {
			sheet.setColumnWidth(i, colWidthList.get(i));
			cell = row.createCell(i);
			cell.setCellValue(headers.get(i));
			cell.setCellStyle(csBoldAndBordered);
		}
		
		for (IUserSessionReport user: users) {
			int colCount = 0;
			row = sheet.createRow(rowCount++);  
			cell = row.createCell(colCount++);
			cell.setCellValue(String.valueOf(counter++));
			cell.setCellStyle(csBordered);
			
			
			cell = row.createCell(colCount++);
			cell.setCellValue(user.getUsername());
			cell.setCellStyle(csBordered);
			
			if(user.getAgentStatus().equals("0")) {
				cell = row.createCell(colCount++);
	            cell.setCellValue("Pasif");
	            cell.setCellStyle(csBordered);
			}
			else if(user.getAgentStatus().equals("1")) {
				cell = row.createCell(colCount++);
	            cell.setCellValue("Aktif");
	            cell.setCellStyle(csBordered);
			}
			
			if(user.getSessionEvent() == 1) {
				cell = row.createCell(colCount++);
	            cell.setCellValue("Oturum Açıldı");
	            cell.setCellStyle(csBordered);
			}
			else if(user.getSessionEvent() == 2) {
				cell = row.createCell(colCount++);
	            cell.setCellValue("Oturum 	Kapatıldı");
	            cell.setCellStyle(csBordered);
			}
			
			
			cell = row.createCell(colCount++);
			cell.setCellValue(new SimpleDateFormat("dd/MM/yyyy HH:mm:ss").format(user.getCreateDate()));
			cell.setCellStyle(csBordered);
			
			
			cell = row.createCell(colCount++);
			cell.setCellValue(user.getHostname());
			cell.setCellStyle(csBordered);
			
			for (int i = 0; i < maxCountOfMacAddresses; i++) {
				try {
					cell = row.createCell(colCount++);
					cell.setCellValue(user.getMacAddresses().split(",")[i].replace("'", "").trim());
					cell.setCellStyle(csBordered);
				} catch (Exception e) {
					cell.setCellValue("");
					cell.setCellStyle(csBordered);
				}
			}

			for (int i = 0; i < maxCountOfIPAddresses; i++) {
				try {
					cell = row.createCell(colCount++);
					cell.setCellValue(user.getIpAddresses().split(",")[i].replace("'", "").trim());
					cell.setCellStyle(csBordered);
				} catch (Exception e) {
					cell.setCellValue("");			
					cell.setCellStyle(csBordered);
				}
			}
			
			
			colCount= 0;
			
		}

		try {
			FileOutputStream outputStream = new FileOutputStream(exportFile);
			wb.write(outputStream);
			wb.close();
		} catch (FileNotFoundException e) {
			e.printStackTrace();
		} catch (IOException e) {
			e.printStackTrace();
		}
		return fileToByteCode(exportFile);
	}
	

	private String getFileWriteLocation() {
		if(System.getProperty("user.dir").equals("/")) {
			return "/opt/tomcat/webapps/";
		}
		return "/tmp/";
	}

	private  byte[] fileToByteCode(String filePath) {
		FileInputStream fi;
		try {
			fi = new FileInputStream(filePath);
			ByteArrayOutputStream baos = new ByteArrayOutputStream();
			int c;
			while ((c = fi.read()) != -1) {
				baos.write(c);
			}
			fi.close();
			byte[] fileContent = baos.toByteArray();
			baos.close();
			deleteLocalFile(filePath);
			return fileContent;
		} catch (FileNotFoundException e) {
			logger.error("File not found for converting to byte code. Error: " + e.getMessage());
			return null;
		} catch (IOException e) {
			logger.error("Error occured while converting file to byte code. Error: " + e.getMessage());
			return null;
		}
	}

	private void deleteLocalFile(String path) {
		File file = new File(path);
		if (!file.isDirectory() && file.exists()) {
			file.delete();
		}
	}

}