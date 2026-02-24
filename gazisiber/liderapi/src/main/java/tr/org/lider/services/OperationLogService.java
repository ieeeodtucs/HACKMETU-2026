package tr.org.lider.services;

import java.util.Date;
import java.util.List;
import javax.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import tr.org.lider.dto.OperationLogDTO;
import tr.org.lider.entities.OperationLogImpl;
import tr.org.lider.entities.OperationType;
import tr.org.lider.repositories.OperationLogCriteriaBuilder;
import tr.org.lider.repositories.OperationLogRepository;


/**
 * 
 * Service for operation logs.
 * @author Edip YILDIZ
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 *
 */
@Service
public class OperationLogService {

	Logger logger = LoggerFactory.getLogger(OperationLogService.class);

	@Autowired
	private OperationLogRepository operationLogRepository;

	@Autowired 
	private HttpServletRequest httpRequest;
	
	@Autowired
	private OperationLogCriteriaBuilder operationLogCriteriaBuilder;
	
	public Long count() {
		return operationLogRepository.count();
	}

	public void saveOperationLog(OperationType operationType,String logMessage,byte[] requestData ) {
		logger.info("Operation log saving. Log Type {} Log Message {}",operationType.name(),logMessage);

		if (AuthenticationService.isLogged()) {
			String userId = AuthenticationService.getDn();
			OperationLogImpl operationLogImpl= new OperationLogImpl();
			operationLogImpl.setCreateDate(new Date());
			operationLogImpl.setCrudType(operationType);
			operationLogImpl.setLogMessage(logMessage);
			operationLogImpl.setRequestData(requestData);
			operationLogImpl.setUserId(userId);
			operationLogImpl.setRequestIp(httpRequest.getRemoteHost());
			operationLogRepository.save(operationLogImpl);
		}
	}

	public OperationLogImpl saveOperationLog(OperationType operationType,String logMessage,byte[] requestData, Long taskId, Long policyId, Long profileId  ) {
		logger.info("Operation log saving. Log Type {} Log Message {}",operationType.name(),logMessage);

		OperationLogImpl operationLogImpl= new OperationLogImpl();

		operationLogImpl.setCreateDate(new Date());
		operationLogImpl.setCrudType(operationType);
		operationLogImpl.setLogMessage(logMessage);
		operationLogImpl.setRequestData(requestData);
		operationLogImpl.setTaskId(taskId);
		operationLogImpl.setProfileId(profileId);
		operationLogImpl.setPolicyId(policyId);

		if (AuthenticationService.isLogged()) {
			String userId = AuthenticationService.getDn();
			operationLogImpl.setUserId(userId);
		}

		HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
		operationLogImpl.setRequestIp(request.getRemoteAddr());
		return operationLogRepository.save(operationLogImpl);
	}

	public OperationLogImpl saveOperationLog(OperationLogImpl operationLogImpl) {
		return operationLogRepository.save(operationLogImpl);
	}

	public void deleteOperationLog(OperationLogImpl operationLogImpl) {
		operationLogRepository.delete(operationLogImpl);
	}

	public void updateOperationLog(OperationLogImpl operationLogImpl) {
		operationLogRepository.save(operationLogImpl);
	}

	public OperationLogImpl getOperationLog(Long id) {
		return operationLogRepository.findOne(id);
	}

	public List<OperationLogImpl> getOperationLogs() {
		return operationLogRepository.findAll();
	}

	public Page<OperationLogImpl> getLoginLogsByLiderConsole(OperationLogDTO operationLogDTO) {
		PageRequest pageable = PageRequest.of(operationLogDTO.getPageNumber() - 1, operationLogDTO.getPageSize(), Sort.by("createDate").descending());
		String userId = AuthenticationService.getDn();
		Page<OperationLogImpl> pagedResult = null;
		int sessionTypeId = 0;
		if (operationLogDTO.getOperationType().equals("login")) {
			sessionTypeId = OperationType.LOGIN.getId();
		} else if (operationLogDTO.getOperationType().equals("logout")) {
			sessionTypeId = OperationType.LOGOUT.getId();
		}
		pagedResult = operationLogRepository.findByUserIdAndOperationType(userId, sessionTypeId, OperationType.LOGIN.getId(), OperationType.LOGOUT.getId(), pageable);
		return pagedResult;
	}
	
	public OperationLogImpl getSelectedLogById(Long id) {
		return operationLogRepository.findOne(id);
	}
	
	public Page<OperationLogImpl> getOperationLogsByFilter(OperationLogDTO operationLogDTO) {
		Page<OperationLogImpl> operationLogImpl = operationLogCriteriaBuilder.filterLogs(operationLogDTO);
		return operationLogImpl;
	}
	
	public Page<OperationLogImpl> getLastActivityByUserIdDescLimitTen(String userId) {
		PageRequest pageable = PageRequest.of(1 - 1, 10, Sort.by("createDate").descending());
		return operationLogRepository.findOrderByCreateDateDesc10ByUserId(userId, pageable);
	}
}
