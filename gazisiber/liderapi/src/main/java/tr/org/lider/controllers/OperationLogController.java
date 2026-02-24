package tr.org.lider.controllers;

import java.text.SimpleDateFormat;
import java.util.Date;

import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.dto.OperationLogDTO;
import tr.org.lider.entities.OperationLogImpl;
import tr.org.lider.entities.OperationType;
import tr.org.lider.services.ExcelExportService;
import tr.org.lider.services.OperationLogService;

/**
 * 
 * Return the operation log reports
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 *
 */

@RestController
@RequestMapping("/api/operation")
@Tag(name = "Operation Log ", description = "Operation Log Service")
public class OperationLogController {

	private final Logger logger = org.slf4j.LoggerFactory.getLogger(this.getClass());

	
	@Autowired
	private OperationLogService logService;
	
	@Autowired
	private ExcelExportService excelService;
	
		
	@Operation(summary = "Lider login history", description = "", tags = { "operation-log" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Find all login history for lider",
					  content = { @Content(schema = @Schema(implementation = OperationLogImpl.class))}),
			  @ApiResponse(responseCode = "417",description = "Could not retrieve login history. Unexpected error occured.",
			  		 content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/login")
	public ResponseEntity<?> loginConsoleUserList(OperationLogDTO operationLogDTO) {
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(logService.getLoginLogsByLiderConsole(operationLogDTO));
	}
	
	@Operation(summary = "Get operation log type", description = "", tags = { "operation-log" })
	@ApiResponses(value = { 
      	  @ApiResponse(responseCode = "200", description = "Get operation log type.",
			  content = { @Content(schema = @Schema(implementation = OperationLogImpl.class))}),
		  @ApiResponse(responseCode = "417",description = "Could not retrieve operation log type. Unexpected error occured.",
	   		 content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/types")
	public ResponseEntity<?> getOperationType() {
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(OperationType.values());
	}
	
	@Secured({"ROLE_ADMIN", "ROLE_OPERATION_LOG"})
	@Operation(summary = "Lider usage history.", description = "", tags = { "operation-log" })
	@ApiResponses(value = { 
      	  @ApiResponse(responseCode = "200", description = "Get usage history for lider.",
			  content = { @Content(schema = @Schema(implementation = OperationLogImpl.class))}),
		  @ApiResponse(responseCode = "417",description = "Coul not retrieve usage history. Unexpected error occured.",
	   		 content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/logs")
	public ResponseEntity<?> operationLogs(OperationLogDTO operationLogDTO) {
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(logService.getOperationLogsByFilter(operationLogDTO));
	}
	
	@Secured({"ROLE_ADMIN", "ROLE_OPERATION_LOG"})
	@Operation(summary = "Get selected log", description = "", tags = { "operation-log" })
	@ApiResponses(value = { 
      	  @ApiResponse(responseCode = "200", description = "Get selected log.",
			  content = { @Content(schema = @Schema(implementation = OperationLogImpl.class))}),
		  @ApiResponse(responseCode = "417",description = "Failed to get selected log.Unexpected error occured.",
	   		 content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/selectedLog")
	public ResponseEntity<?> selectedOpertaionLog(@RequestParam (value = "id") Long id ) {
		OperationLogImpl log =  logService.getSelectedLogById(id);
		if(log.getRequestData() != null)
			log.setRequestDataStr(new String(log.getRequestData()));
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(logService.getSelectedLogById(id));
	}
	
	@Operation(summary = "Exports filtered operation logs list to excel.", description = "", tags = { "operation-log" })
	@ApiResponses(value = { 
      	  @ApiResponse(responseCode = "200", description = "Created excel file successfully.",
			  content = { @Content(schema = @Schema(implementation = OperationLogImpl.class))}),
		  @ApiResponse(responseCode = "400",description = "Could not create operation log report.Bad request.",
	   		 content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/export", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> export(OperationLogDTO operationLogDTO) {
		operationLogDTO.setPageNumber(1);
		operationLogDTO.setPageSize(logService.count().intValue());
		Page<OperationLogImpl> logs = logService.getOperationLogsByFilter(operationLogDTO);
		
		try {
			HttpHeaders headers = new HttpHeaders();
			headers.add("fileName", "Sistem Guncesi Raporu_" + new SimpleDateFormat("dd_MM_yyyy_HH:mm:ss.SSS").format(new Date()) + ".xlsx");
			headers.setContentType(MediaType.parseMediaType("application/csv"));
			headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");
			byte[] excelContent = excelService.generateOperationLogReport(logs.getContent());
			return new ResponseEntity<byte[]>(excelContent,headers,HttpStatus.OK);
		}catch (Exception e) {
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