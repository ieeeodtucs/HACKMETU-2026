package tr.org.lider.services;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import org.jivesoftware.smack.SmackException.NotConnectedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonGenerationException;
import com.fasterxml.jackson.databind.JsonMappingException;

import tr.org.lider.entities.CommandImpl;
import tr.org.lider.entities.OperationType;
import tr.org.lider.entities.TaskImpl;
import tr.org.lider.ldap.DNType;
import tr.org.lider.message.service.IMessagingService;
import tr.org.lider.messaging.messages.ILiderMessage;
import tr.org.lider.messaging.messages.UpdateScheduledTaskMessageImpl;
import tr.org.lider.repositories.TaskRepository;

@Service
public class ScheduledTaskService {

	Logger logger = LoggerFactory.getLogger(ScheduledTaskService.class);

	@Autowired
	private IMessagingService messagingService;

	@Autowired
	private CommandService commandService;

	@Autowired
	private OperationLogService operationLogService; 
	
	@Autowired
	private TaskRepository taskRepository;

	@Autowired
	private NotificationDispatchService notificationDispatchService;
	
	public ResponseEntity<CommandImpl> updateScheduledTask(Long id, String cronExpression) {

		/**
		 * Update scheduled task by task id and cronExpression. get task id from command
		 */
		List<String> uidList = new ArrayList<String>();
		CommandImpl command = commandService.getCommand(id);
		if (command != null) {
			uidList = command.getUidList();
		}
		String logMessage = "";
		if (command.getDnType().equals(DNType.GROUP)) {
			logMessage = command.getDnList().toString() +" istemci grubu için zamanlanmış görev güncellendi.";
		} else {
			logMessage = command.getDnList().toString() + " istemcisi için  zamanlanmış görev güncellendi.";
		}
		try {
			operationLogService.saveOperationLog(OperationType.UPDATE_SCHEDULED_TASK, logMessage, command.getTask().getCronExpression().getBytes(), command.getTask().getId(), null, null);
		} catch (Exception e) {
			e.printStackTrace();
		}
		
		if (uidList != null && !uidList.isEmpty()) {
		
			for (String uid : uidList) {
				ILiderMessage message = null;
				message = new UpdateScheduledTaskMessageImpl(uid.toString(), command.getTask().getId(), cronExpression, null);
				try {
					messagingService.sendMessage(message);
				} catch (JsonGenerationException e) {
					e.printStackTrace();
				} catch (JsonMappingException e) {
					e.printStackTrace();
				} catch (NotConnectedException e) {
					e.printStackTrace();
				} catch (IOException e) {
					e.printStackTrace();
				}
			}
		}
		TaskImpl task = command.getTask();
		task.setModifyDate(new Date());
		task.setCronExpression(cronExpression);
		taskRepository.save(task);
		CommandImpl updatedCommand = commandService.getCommand(id);
		notificationDispatchService.dispatch("task.scheduled.updated",
				"Zamanlanmış Görev Güncellendi",
				new NotificationBodyBuilder()
						.field("Görev", command.getTask().getCommandClsId())
						.field("Yeni Cron İfadesi", cronExpression)
						.field("Hedef", logMessage)
						.build());
		return new ResponseEntity<CommandImpl>(updatedCommand, HttpStatus.OK); 
	}
	
	public ResponseEntity<CommandImpl> cancelScheduledTask(Long id) {

		/**
		 * Update scheduled task by task id and cronExpression. get task id from command
		 */
		List<String> uidList = new ArrayList<String>();
		CommandImpl command = commandService.getCommand(id);
		if (command != null) {
			uidList = command.getUidList();
		}
		String logMessage = "";
		if (command.getDnType().equals(DNType.GROUP)) {
			logMessage = command.getDnList().toString() +" istemci grubu için zamanlanmış görev iptal edildi";
		} else {
			logMessage = command.getDnList().toString() + " istemcisi için  zamanlanmış görev iptal edildi.";
		}
		try {
			operationLogService.saveOperationLog(OperationType.CANCEL_SCHEDULED_TASK, logMessage, command.getTask().getCronExpression().getBytes(), command.getTask().getId(), null, null);
		} catch (Exception e) {
			e.printStackTrace();
		}
		
		if (uidList != null && !uidList.isEmpty()) {
		
			for (String uid : uidList) {
				ILiderMessage message = null;
				message = new UpdateScheduledTaskMessageImpl(uid.toString(), command.getTask().getId(), null, null);
				try {
					messagingService.sendMessage(message);
				} catch (JsonGenerationException e) {
					e.printStackTrace();
				} catch (JsonMappingException e) {
					e.printStackTrace();
				} catch (NotConnectedException e) {
					e.printStackTrace();
				} catch (IOException e) {
					e.printStackTrace();
				}
			}
		}
		TaskImpl task = command.getTask();
		task.setModifyDate(new Date());
		task.setDeleted(true);
		taskRepository.save(task);
		CommandImpl canceledCommand = commandService.getCommand(id);
		notificationDispatchService.dispatch("task.scheduled.cancelled",
				"Zamanlanmış Görev İptal Edildi",
				new NotificationBodyBuilder()
						.field("Görev", command.getTask().getCommandClsId())
						.field("Hedef", logMessage)
						.build());
		return new ResponseEntity<CommandImpl>(canceledCommand, HttpStatus.OK); 
	}
}
