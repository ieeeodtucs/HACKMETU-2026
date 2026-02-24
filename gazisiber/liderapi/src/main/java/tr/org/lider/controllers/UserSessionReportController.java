package tr.org.lider.controllers;

import java.text.SimpleDateFormat;
import java.util.Date;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.dto.UserSessionDTO;
import tr.org.lider.entities.OperationLogImpl;
import tr.org.lider.services.ExcelExportService;
import tr.org.lider.services.UserSessionReportService;
import tr.org.lider.utils.IUserSessionReport;

@Secured({"ROLE_ADMIN", "ROLE_USER_SESSION_REPORT" })
@RestController
@RequestMapping("/api/lider/user-session")
@Tag(name = "User Session", description = "User Session Rest Service")
public class UserSessionReportController {
	
	Logger logger = LoggerFactory.getLogger(this.getClass());

	@Autowired
	private UserSessionReportService userSessionReportService;
	
	@Autowired
	private ExcelExportService excelService;
	
	@Operation(summary = "Lider user session history.", description = "", tags = { "user-sesion" })
	@ApiResponses(value = { 
      	  @ApiResponse(responseCode = "200", description = "Get user session for lider.",
			  content = { @Content(schema = @Schema(implementation = OperationLogImpl.class))}),
		  @ApiResponse(responseCode = "417",description = "Coul not retrieve user session. Unexpected error occured.",
	   		 content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/list")
	public ResponseEntity<?> getUserSessions(UserSessionDTO userSessionDTO) {
		Page<IUserSessionReport> users = userSessionReportService.getUserSessionByFilter(userSessionDTO);
		
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(users);
	}
	
	@Operation(summary = "Exports filtered user session list to excel.", description = "", tags = { "user-sesion" })
	@ApiResponses(value = { 
      	  @ApiResponse(responseCode = "200", description = "Created excel file successfully.",
			  content = { @Content(schema = @Schema(implementation = OperationLogImpl.class))}),
		  @ApiResponse(responseCode = "400",description = "Could not create operation log report.Bad request.",
	   		 content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/export", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> export(UserSessionDTO userSessionDTO) {
		userSessionDTO.setPageNumber(1);
		userSessionDTO.setPageSize(userSessionReportService.count().intValue());
		Page<IUserSessionReport> users = userSessionReportService.getUserSessionByFilter(userSessionDTO);		
		try {
			HttpHeaders headers = new HttpHeaders();
			headers.add("fileName", "Oturum Raporu_" + new SimpleDateFormat("dd_MM_yyyy_HH:mm:ss.SSS").format(new Date()) + ".xlsx");
			headers.setContentType(MediaType.parseMediaType("application/csv"));
			headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");
			byte[] excelContent = excelService.generateUserSessionReport(users.getContent());
			return new ResponseEntity<byte[]>(excelContent, headers,  HttpStatus.OK);
		} catch (Exception e) {
        	logger.error("Error occured while creating excel report Error: ." + e.getMessage());
        	HttpHeaders headers = new HttpHeaders();
        	headers.add("message", "Error occured while creating excel report. Error: " + e.getMessage());
        	
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}

}
