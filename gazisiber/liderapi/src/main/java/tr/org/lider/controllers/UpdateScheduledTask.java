package tr.org.lider.controllers;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.services.ScheduledTaskService;

/**
 *  Scheduled task as cancel or updated
 */

@Secured({"ROLE_ADMIN", "ROLE_COMPUTERS" })
@RestController
@RequestMapping("/api/lider/scheduled-task")
@Tag(name = "Update scheduled task", description = "Update Scheduled Task")
public class UpdateScheduledTask {
	
	Logger logger = LoggerFactory.getLogger(TaskController.class);
	
	@Autowired
	public ScheduledTaskService scheduledTaskService;
	
	@Operation(summary = "Update scheduled task", description = "", tags = { "update-scheduled" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Update scheduled task"),
			  @ApiResponse(responseCode = "400", description = "Scheduled task id not found!", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/update")
	public ResponseEntity<?> updateScheduledTask(@RequestParam (value = "id", required=false) Long id,
			@RequestParam (value = "cronExpression", required=false) String cronExpression) {
		
		logger.info("Request received. URL: '/api/lider/scheduled-task/update'");
		ResponseEntity<?> response = scheduledTaskService.updateScheduledTask(id, cronExpression);
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(response);
	}
	
	@Operation(summary = "Cancel scheduled task", description = "", tags = { "cancel-scheduled" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = ""),
			  @ApiResponse(responseCode = "400", description = "Scheduled task id  not found", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/cancel")
	public ResponseEntity<?> cancelScheduledTask(@RequestParam (value = "id", required=false) Long id) {
		
		logger.info("Request received. URL: '/api/lider/scheduled-task/cancel'");
		ResponseEntity<?> response = scheduledTaskService.cancelScheduledTask(id);
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(response);
	}
}
